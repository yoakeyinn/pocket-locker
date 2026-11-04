import { t } from '../styles/i18n';
import React, { createContext, useContext, useEffect, useRef } from 'react';
import { Platform, PermissionsAndroid, NativeModules, Linking, AppState, AppStateStatus, Permission } from 'react-native';
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import { BleManager, Device } from 'react-native-ble-plx';
import { create } from 'zustand';
import StorageService, { LogService } from './StorageService';
import { DEFAULT_SECURITY_PIN, Puerta, TipoDispositivo, USUARIO_POR_DEFECTO } from './comun';

const NUS_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_RX_UUID      = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_TX_UUID      = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

export const SIN_NOMBRE = 'Sin nombre';

const enmascarar = (comando: string) =>
  comando.trim().replace(/^PLK:(?!LOG:|AUTH:|REQ_CHALLENGE)[^:]+:/, 'PLK:***:');

export type TipoConexion = TipoDispositivo | null;

export interface DispositivoBT {
  name: string;
  address: string;
  bleMac?: string;
  type: TipoDispositivo;
}

export type BluetoothStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'unauthorized'
  | 'disabled'
  | 'unpaired';

class BluetoothServiceClass {
  private bleManager: BleManager | null = null;
  private bleDevice: Device | null = null;
  private bleTxSubscription: any = null;
  private bleDisconnectSubscription: any = null;

  private classicDevice: any = null;
  private classicDisconnectSub: any = null;
  private classicDataSub: any = null;
  private classicConexionEnCurso: Promise<void> | null = null;

  private tipoActivo: TipoConexion = null;
  private bleMacCache: Map<string, string> = new Map();
  private onDesconexionCallback: (() => void) | null = null;
  private onDatosCallback: ((data: string) => void) | null = null;

  constructor() {
    LogService.info('[BluetoothService] Inicializado servicio Bluetooth');
  }

  getApiLevel(): number {
    return Platform.OS === 'android' ? (Platform.Version as number) : 0;
  }

  async solicitarPermisos(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    try {
      const apiLevel = this.getApiLevel();
      const P = PermissionsAndroid.PERMISSIONS;
      const GRANTED = PermissionsAndroid.RESULTS.GRANTED;
      let concedido: boolean;
      let resultado: Record<string, string>;

      if (apiLevel >= 31) {
        const perms: Permission[] = [P.BLUETOOTH_SCAN, P.BLUETOOTH_CONNECT];
        if (apiLevel >= 34) perms.push(P.BLUETOOTH_ADVERTISE);
        resultado = await PermissionsAndroid.requestMultiple(perms);
        concedido = resultado[P.BLUETOOTH_SCAN] === GRANTED && resultado[P.BLUETOOTH_CONNECT] === GRANTED;
      } else {
        resultado = await PermissionsAndroid.requestMultiple([P.ACCESS_FINE_LOCATION, P.ACCESS_COARSE_LOCATION]);
        concedido = resultado[P.ACCESS_FINE_LOCATION] === GRANTED || resultado[P.ACCESS_COARSE_LOCATION] === GRANTED;
      }

      LogService.info(`[Bluetooth] Permisos solicitados (API ${apiLevel}): ${concedido ? 'concedidos' : 'DENEGADOS'}`, resultado);
      return concedido;
    } catch (e: any) {
      LogService.error('[Bluetooth] Error en solicitud de permisos', e);
      return false;
    }
  }

  async tienePermisos(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    try {
      const P = PermissionsAndroid.PERMISSIONS;
      if (this.getApiLevel() >= 31) {
        const [scan, connect] = await Promise.all([
          PermissionsAndroid.check(P.BLUETOOTH_SCAN),
          PermissionsAndroid.check(P.BLUETOOTH_CONNECT),
        ]);
        return scan && connect;
      }
      const [fine, coarse] = await Promise.all([
        PermissionsAndroid.check(P.ACCESS_FINE_LOCATION),
        PermissionsAndroid.check(P.ACCESS_COARSE_LOCATION),
      ]);
      return fine || coarse;
    } catch (e) {
      LogService.warn('[Bluetooth] No se pudo comprobar el estado de los permisos', e);
      return false;
    }
  }

  async esSoportado(): Promise<boolean> {
    if (NativeModules.RNBluetoothClassic) {
      try {
        const ok = await RNBluetoothClassic.isBluetoothAvailable();
        if (ok) return true;
      } catch (e) {
        LogService.warn('[Bluetooth] isBluetoothAvailable falló', e);
      }
    }
    return !!this.getBleManager();
  }

  async estaEncendido(): Promise<boolean> {
    if (NativeModules.RNBluetoothClassic) {
      try {
        const encendido = await RNBluetoothClassic.isBluetoothEnabled();
        if (encendido) return true;
      } catch (e) {
        LogService.warn('[Bluetooth] isBluetoothEnabled falló', e);
      }
    }
    const mgr = this.getBleManager();
    if (mgr) {
      try {
        const state = await mgr.state();
        return state === 'PoweredOn';
      } catch (e) {
        LogService.warn('[BLE] No se pudo leer el estado del adaptador', e);
      }
    }
    return false;
  }

  async pedirActivar(abrirAjustes: boolean = true): Promise<boolean> {
    if (Platform.OS === 'android' && NativeModules.RNBluetoothClassic) {
      try {
        const hayAdaptador = await RNBluetoothClassic.isBluetoothAvailable().catch(() => false);
        if (!hayAdaptador) {
          LogService.warn('[Bluetooth] Este dispositivo no tiene adaptador Bluetooth');
          return false;
        }
        if (!(await this.tienePermisos())) {
          LogService.warn('[Bluetooth] No se puede pedir activar Bluetooth sin permisos');
          return false;
        }
        const activado = await RNBluetoothClassic.requestBluetoothEnabled();
        LogService.info(`[Bluetooth] Petición de activación del Bluetooth: ${activado ? 'aceptada' : 'rechazada'}`);
        return activado;
      } catch (e) {
        LogService.warn('[Bluetooth] requestBluetoothEnabled falló', e);
        return false;
      }
    }
    if (!abrirAjustes) {
      LogService.warn('[Bluetooth] Sin módulo nativo de Bluetooth: no se puede pedir activarlo');
      return false;
    }
    return this.abrirAjustesBluetooth().then(() => false);
  }

  private async abrirAjusteAndroid(action: string): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
      const IntentLauncher = require('expo-intent-launcher');
      await IntentLauncher.startActivityAsync(action);
      return true;
    } catch (e) {
      LogService.warn(`[Bluetooth] No se pudo abrir ${action}`, e);
      return false;
    }
  }

  async abrirAjustesBluetooth(): Promise<void> {
    try {
      if (await this.abrirAjusteAndroid('android.settings.BLUETOOTH_SETTINGS')) return;
      await Linking.openSettings();
    } catch (e) {
      LogService.warn('Error al abrir configuración Bluetooth', e);
      Linking.openSettings().catch(() => {});
    }
  }

  async abrirAjustesApp(): Promise<void> {
    try {
      await Linking.openSettings();
    } catch (e) {
      LogService.warn('Error al abrir configuración de la app', e);
    }
  }

  private getBleManager(): BleManager | null {
    if (!this.bleManager) {
      try {
        this.bleManager = new BleManager();
      } catch (e) {
        LogService.warn('[BLE] BleManager no disponible', e);
        this.bleManager = null;
      }
    }
    return this.bleManager;
  }

  async escanearPLBT(timeoutMs = 8000): Promise<string | null> {
    const mgr = this.getBleManager();
    if (!mgr) {
      LogService.warn('[BLE] escanearPLBT: no hay BleManager');
      return null;
    }

    LogService.info(`[BLE] Buscando PLBT durante ${timeoutMs} ms`);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        mgr.stopDeviceScan();
        LogService.warn('[BLE] Tiempo agotado: PLBT no encontrado');
        resolve(null);
      }, timeoutMs);

      mgr.startDeviceScan(null, null, (error: any, device: Device | null) => {
        if (error) {
          mgr.stopDeviceScan();
          clearTimeout(timer);
          LogService.error('[BLE] Error durante el escaneo de PLBT', error);
          resolve(null);
          return;
        }
        if (device && (device.name === 'PLBT' || device.localName === 'PLBT')) {
          mgr.stopDeviceScan();
          clearTimeout(timer);
          LogService.info(`[BLE] PLBT encontrado (id=${device.id}, rssi=${device.rssi})`);
          resolve(device.id);
        }
      });
    });
  }

  private async conectarBLE(
    bleId: string | null,
    onDesconexion: () => void,
    onDatos: (data: string) => void
  ): Promise<string> {
    const mgr = this.getBleManager();
    if (!mgr) throw new Error('BleManager no inicializado');

    const targetId = bleId || (await this.escanearPLBT(8000));
    if (!targetId) throw new Error('No se encontró el dispositivo PLBT por BLE');

    LogService.info(`[BLE] Conectando a ${targetId}`);
    this.bleDevice = await mgr.connectToDevice(targetId, { timeout: 12000, autoConnect: false });
    await this.bleDevice.discoverAllServicesAndCharacteristics();

    const services = await this.bleDevice.services();
    LogService.info(`[BLE] Servicios descubiertos: ${services.map((s) => s.uuid).join(', ') || '(ninguno)'}`);
    if (!services.some((s) => s.uuid.toLowerCase() === NUS_SERVICE_UUID)) {
      throw new Error(`Servicio Nordic UART (${NUS_SERVICE_UUID}) no encontrado`);
    }

    this.limpiarSuscripcionesBLE();
    this.bleDisconnectSubscription = mgr.onDeviceDisconnected(targetId, (error) => {
      LogService.warn(`[BLE] Dispositivo ${targetId} desconectado`, error);
      this.bleDevice = null;
      this.limpiarSuscripcionesBLE();
      onDesconexion();
    });

    this.bleTxSubscription = this.bleDevice.monitorCharacteristicForService(
      NUS_SERVICE_UUID,
      NUS_TX_UUID,
      (error, characteristic) => {
        if (!error && characteristic?.value) {
          onDatos(atob(characteristic.value));
        }
      }
    );

    return targetId;
  }

  private async enviarBLE(payload: string): Promise<void> {
    if (!this.bleDevice) throw new Error('No hay dispositivo BLE conectado');
    await this.bleDevice.writeCharacteristicWithResponseForService(
      NUS_SERVICE_UUID,
      NUS_RX_UUID,
      btoa(payload)
    );
  }

  private limpiarSuscripcionesBLE(): void {
    if (this.bleTxSubscription) {
      try { this.bleTxSubscription.remove(); } catch {}
      this.bleTxSubscription = null;
    }
    if (this.bleDisconnectSubscription) {
      try { this.bleDisconnectSubscription.remove(); } catch {}
      this.bleDisconnectSubscription = null;
    }
  }

  async getBondedDevices(): Promise<any[]> {
    if (!NativeModules.RNBluetoothClassic) return [];
    try {
      if (!(await this.tienePermisos())) return [];
      return await RNBluetoothClassic.getBondedDevices();
    } catch (e) {
      LogService.warn('[Bluetooth] getBondedDevices falló', e);
      return [];
    }
  }

  async vincularDispositivo(address: string): Promise<boolean> {
    if (!NativeModules.RNBluetoothClassic) return false;
    try {
      if (!(await this.tienePermisos())) return false;
      LogService.info(`[Bluetooth] Emparejando con ${address}`);
      const dev = await RNBluetoothClassic.pairDevice(address);
      LogService.info(`[Bluetooth] Emparejamiento con ${address}: ${dev ? 'correcto' : 'sin resultado'}`);
      return !!dev;
    } catch (e) {
      LogService.error(`[Bluetooth] Error al emparejar con ${address}`, e);
      return false;
    }
  }

  async desvincularDispositivo(address: string): Promise<boolean> {
    if (!NativeModules.RNBluetoothClassic) return false;
    try {
      if (typeof (RNBluetoothClassic as any).unpairDevice === 'function') {
        const resultado = await (RNBluetoothClassic as any).unpairDevice(address);
        LogService.info(`[Bluetooth] Desemparejado de ${address}: ${resultado}`);
        return resultado;
      }
      LogService.warn('[Bluetooth] unpairDevice no está disponible en esta librería');
      return true;
    } catch (e) {
      LogService.error(`[Bluetooth] Error al desemparejar de ${address}`, e);
      return false;
    }
  }

  async cancelarDescubrimiento(): Promise<void> {
    if (!(await this.tienePermisos())) return;
    if (NativeModules.RNBluetoothClassic) {
      try { await RNBluetoothClassic.cancelDiscovery(); } catch (e) { LogService.warn('[Bluetooth] cancelDiscovery falló', e); }
    }
    try { this.getBleManager()?.stopDeviceScan(); } catch (e) { LogService.warn('[BLE] stopDeviceScan falló', e); }
  }

  async listarDispositivos(
    onDispositivoEncontrado?: (dev: DispositivoBT) => void,
    duracionMs: number = 6000
  ): Promise<DispositivoBT[]> {
    LogService.info(`[Bluetooth] Buscando dispositivos durante ${duracionMs} ms`);
    const okPermisos = await this.solicitarPermisos();
    if (!okPermisos) throw new Error(t('pl_error_permisos'));

    await this.cancelarDescubrimiento();
    await new Promise((r) => setTimeout(r, 300));

    const mapa = new Map<string, DispositivoBT>();
    const emitir = (dev: DispositivoBT) => {
      const k = dev.address.toLowerCase();
      const prev = mapa.get(k);
      if (prev) {
        if ((!prev.name || prev.name === SIN_NOMBRE) && dev.name && dev.name !== SIN_NOMBRE) {
          prev.name = dev.name;
          onDispositivoEncontrado?.(prev);
        }
        return;
      }
      mapa.set(k, dev);
      LogService.info(`[Bluetooth] Dispositivo encontrado: ${dev.name} (${dev.address}, ${dev.type})`);
      onDispositivoEncontrado?.(dev);
    };

    if (NativeModules.RNBluetoothClassic) {
      try {
        const conectados = await RNBluetoothClassic.getConnectedDevices();
        conectados?.forEach((c: any) => c?.address && emitir({ name: c.name || SIN_NOMBRE, address: c.address, type: 'classic' }));
      } catch (e) {
        LogService.warn('[Bluetooth] getConnectedDevices falló', e);
      }

      try {
        const bonded = await RNBluetoothClassic.getBondedDevices();
        bonded?.forEach((b: any) => {
          const u = (b?.name || '').toUpperCase();
          if (b?.address && (u.includes('PLBT') || u.includes('POCKET') || u.includes('ESP32'))) {
            emitir({ name: b.name || 'PLBT', address: b.address, type: 'classic' });
          }
        });
      } catch (e) {
        LogService.warn('[Bluetooth] getBondedDevices (listado) falló', e);
      }
    }

    let subClassic: any = null;
    let classicP: Promise<any> = Promise.resolve([]);

    if (NativeModules.RNBluetoothClassic) {
      try {
        if (typeof (RNBluetoothClassic as any).onDeviceDiscovered === 'function') {
          subClassic = (RNBluetoothClassic as any).onDeviceDiscovered((ev: any) => {
            if (ev?.device?.address) {
              emitir({ name: ev.device.name || SIN_NOMBRE, address: ev.device.address, type: 'classic' });
            }
          });
        }
        classicP = RNBluetoothClassic.startDiscovery().catch((e) => {
          LogService.warn('[Bluetooth] startDiscovery falló', e);
          return [];
        });
      } catch (e) {
        LogService.warn('[Bluetooth] No se pudo iniciar el descubrimiento Classic', e);
      }
    }

    const bleMgr = this.getBleManager();
    if (bleMgr) {
      try {
        bleMgr.startDeviceScan(null, null, (err, bDev) => {
          if (!err && bDev?.id) {
            emitir({ name: bDev.name || bDev.localName || 'Dispositivo BLE', address: bDev.id, type: 'ble' });
          } else if (err) {
            LogService.warn('[BLE] Error durante el escaneo', err);
          }
        });
      } catch (e) {
        LogService.warn('[BLE] No se pudo iniciar el escaneo', e);
      }
    }

    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, duracionMs);
      classicP.finally(() => { clearTimeout(t); resolve(); });
    });

    try { subClassic?.remove?.(); } catch (e) { LogService.warn('[Bluetooth] No se pudo quitar el listener de descubrimiento', e); }
    await this.cancelarDescubrimiento();

    LogService.info(`[Bluetooth] Búsqueda terminada: ${mapa.size} dispositivo(s)`);
    return Array.from(mapa.values());
  }

  private async conectarClassic(
    mac: string,
    onDesconexion: () => void,
    onDatos: (data: string) => void
  ): Promise<void> {
    if (this.classicConexionEnCurso) return this.classicConexionEnCurso;

    this.classicConexionEnCurso = this._conectarClassicInterno(mac, onDesconexion, onDatos);
    try {
      await this.classicConexionEnCurso;
    } finally {
      this.classicConexionEnCurso = null;
    }
  }

  private async _conectarClassicInterno(
    mac: string,
    onDesconexion: () => void,
    onDatos: (data: string) => void
  ): Promise<void> {
    LogService.info(`[Classic] Conectando a ${mac}`);
    await this.cancelarDescubrimiento();
    await new Promise((r) => setTimeout(r, 600));

    const bonded = await this.getBondedDevices();
    if (!bonded.some((d) => d.address.toUpperCase() === mac.toUpperCase())) {
      LogService.info(`[Classic] ${mac} no está emparejado todavía: se intenta emparejar`);
      const emparejado = await Promise.race([
        this.vincularDispositivo(mac),
        new Promise<boolean>((r) => setTimeout(() => r(false), 6000)),
      ]);
      if (!emparejado) throw new Error(t('pl_error_emparejar'));
    }

    let err1 = '';
    try {
      await this._intentoSocketClassic(mac, { secure: false, secureSocket: false, delimiter: '\n' });
      this.configurarMonitoreoClassic(this.classicDevice, onDesconexion, onDatos);
      return;
    } catch (e: any) {
      err1 = e?.message || String(e);
      LogService.warn(`[Classic] Primer intento (socket inseguro) fallido: ${err1}`, e);
      if (err1.toLowerCase().includes('already')) {
        try {
          const conectados = await RNBluetoothClassic.getConnectedDevices();
          const d = conectados.find((x) => x.address.toUpperCase() === mac.toUpperCase());
          if (d && (await d.isConnected().catch(() => false))) {
            LogService.info(`[Classic] ${mac} ya estaba conectado: se reutiliza la conexión`);
            this.classicDevice = d;
            this.configurarMonitoreoClassic(this.classicDevice, onDesconexion, onDatos);
            return;
          }
        } catch (e2) {
          LogService.warn('[Classic] No se pudo recuperar la conexión existente', e2);
        }
      }
    }

    await new Promise((r) => setTimeout(r, 800));

    try {
      await this._intentoSocketClassic(mac, { secure: true, secureSocket: true, delimiter: '\n' });
      this.configurarMonitoreoClassic(this.classicDevice, onDesconexion, onDatos);
    } catch (err2: any) {
      const msgErr2 = err2?.message || String(err2);
      LogService.error(`[Classic] Segundo intento (socket seguro) fallido: ${msgErr2}`, err2);
      const combined = `${err1} | ${msgErr2}`.toLowerCase();
      if (
        combined.includes('securityexception') ||
        combined.includes('lacks permission') ||
        combined.includes('permission')
      ) {
        throw new Error(t('pl_error_permisos_sistema', { permiso: t('pl_dispositivos_cercanos') }));
      }
      throw new Error(`Fallo conexión Classic: ${err1} | ${msgErr2}`);
    }
  }

  private async _intentoSocketClassic(mac: string, opts: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout de socket Classic (12s)')), 12000);
      RNBluetoothClassic.connectToDevice(mac, opts)
        .then((dev) => {
          clearTimeout(timer);
          if (dev) {
            this.classicDevice = dev;
            resolve();
          } else {
            reject(new Error('connectToDevice retornó nulo'));
          }
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private configurarMonitoreoClassic(
    dev: any,
    onDesconexion: () => void,
    onDatos: (data: string) => void
  ): void {
    this.limpiarSuscripcionesClassic();
    try {
      this.classicDisconnectSub = dev.onDeviceDisconnected(() => {
        this.classicDevice = null;
        this.limpiarSuscripcionesClassic();
        onDesconexion();
      });
      this.classicDataSub = dev.onDataReceived((data: any) => {
        if (data?.data) onDatos(data.data);
      });
    } catch (e) {
      LogService.warn('[Classic] Error configurando listeners', e);
    }
  }

  private limpiarSuscripcionesClassic(): void {
    if (this.classicDisconnectSub) {
      try { this.classicDisconnectSub.remove(); } catch {}
      this.classicDisconnectSub = null;
    }
    if (this.classicDataSub) {
      try { this.classicDataSub.remove(); } catch {}
      this.classicDataSub = null;
    }
  }

  registrarOnDesconexion(cb: () => void): () => void {
    this.onDesconexionCallback = cb;
    return () => { this.onDesconexionCallback = null; };
  }

  registrarOnDatosRecibidos(cb: (data: string) => void): () => void {
    this.onDatosCallback = cb;
    return () => { this.onDatosCallback = null; };
  }

  async conectar(macOrBleId: string, type: TipoDispositivo = 'classic'): Promise<void> {
    LogService.info(`[Bluetooth] Conectando a ${macOrBleId} (tipo preferido: ${type})`);
    await this.desconectar();
    const onDesc = () => {
      LogService.warn('[Bluetooth] Conexión perdida');
      this.onDesconexionCallback?.();
    };
    const onDat = (d: string) => this.onDatosCallback?.(d);

    if (type === 'ble') {
      try {
        const idConectado = await this.conectarBLE(macOrBleId, onDesc, onDat);
        this.tipoActivo = 'ble';
        this.bleMacCache.set(macOrBleId, idConectado);
        LogService.info(`[Bluetooth] Conectado por BLE (id=${idConectado})`);
      } catch (bleErr: any) {
        LogService.warn('[Bluetooth] Falló la conexión BLE', bleErr);
        if (NativeModules.RNBluetoothClassic) {
          LogService.info('[Bluetooth] Se prueba Classic como alternativa');
          await this.conectarClassic(macOrBleId, onDesc, onDat);
          this.tipoActivo = 'classic';
          LogService.info('[Bluetooth] Conectado por Classic (alternativa)');
        } else {
          throw bleErr;
        }
      }
    } else {
      try {
        await this.conectarClassic(macOrBleId, onDesc, onDat);
        this.tipoActivo = 'classic';
        LogService.info('[Bluetooth] Conectado por Classic');
      } catch (classicErr: any) {
        LogService.warn('[Bluetooth] Falló la conexión Classic', classicErr);
        const cachedBleId = this.bleMacCache.get(macOrBleId) || null;
        try {
          LogService.info('[Bluetooth] Se prueba BLE como alternativa');
          const idConectado = await this.conectarBLE(cachedBleId, onDesc, onDat);
          this.tipoActivo = 'ble';
          this.bleMacCache.set(macOrBleId, idConectado);
          LogService.info(`[Bluetooth] Conectado por BLE (alternativa, id=${idConectado})`);
        } catch (bleErr) {
          LogService.error('[Bluetooth] Fallaron Classic y BLE: no hay conexión', bleErr);
          throw classicErr;
        }
      }
    }
  }

  async desconectar(): Promise<void> {
    if (this.bleDevice || this.classicDevice) LogService.info('[Bluetooth] Desconectando');
    this.tipoActivo = null;
    this.limpiarSuscripcionesBLE();
    this.limpiarSuscripcionesClassic();

    if (this.bleDevice) {
      try { await this.bleDevice.cancelConnection(); } catch (e) { LogService.warn('[BLE] cancelConnection falló', e); }
      this.bleDevice = null;
    }
    if (this.classicDevice) {
      try { await this.classicDevice.disconnect(); } catch (e) { LogService.warn('[Classic] disconnect falló', e); }
      this.classicDevice = null;
    }
  }

  async estaConectado(): Promise<boolean> {
    const [classic, ble] = await Promise.all([
      this.classicDevice?.isConnected().catch(() => false),
      this.bleDevice?.isConnected().catch(() => false),
    ]);
    return !!(classic || ble);
  }

  async enviarComando(comando: string, type?: TipoDispositivo): Promise<void> {
    const payload = comando.endsWith('\n') ? comando : comando + '\n';
    const destino = type || this.tipoActivo;
    if (!comando.startsWith('PLK:LOG:')) LogService.info(`[TX] ${enmascarar(comando)} (destino=${destino})`);

    if (destino === 'ble') {
      await this.enviarBLE(payload);
    } else if (destino === 'classic') {
      if (!this.classicDevice) throw new Error('No hay dispositivo Bluetooth Classic conectado');
      await this.classicDevice.write(payload);
    } else {
      throw new Error('No hay ninguna conexión Bluetooth activa');
    }
  }

  async enviarComandoConRespuesta(
    comando: string,
    type?: TipoDispositivo,
    timeoutMs = 4000
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const callbackPrevio = this.onDatosCallback;

      const limpiar = () => {
        if (timer) clearTimeout(timer);
        this.onDatosCallback = callbackPrevio;
      };

      timer = setTimeout(() => {
        limpiar();
        LogService.warn(`[TX] Sin respuesta del dispositivo en ${timeoutMs} ms a ${enmascarar(comando)}: se da por enviado`);
        resolve('OK:TIMEOUT_FALLBACK');
      }, timeoutMs);

      this.onDatosCallback = (linea: string) => {
        if (callbackPrevio) callbackPrevio(linea);
        if (linea.includes('OK:') || linea.includes('ERR:')) {
          limpiar();
          resolve(linea.trim());
        }
      };

      this.enviarComando(comando, type).catch((err) => {
        limpiar();
        reject(err);
      });
    });
  }
}

export const BluetoothService = new BluetoothServiceClass();

export interface PocketState {
  status: BluetoothStatus;
  deviceName: string | null;
  deviceMac: string | null;
  deviceType: TipoDispositivo;
  devicePin: string;
  cargando: boolean;
  tiempoRestanteBloqueo: number;
  userName: string | null;
  ultimaPuerta: Puerta;
}

export interface PocketActions {
  iniciarBloqueoMargen: (segundos?: number) => void;
  guardarNombreUsuario: (nombre: string) => Promise<void>;
  guardarUltimaPuerta: (puerta: Puerta) => Promise<void>;
  conectar: () => Promise<void>;
  conectarDispositivo: (macAddress: string, type?: TipoDispositivo) => Promise<void>;
  desconectar: () => Promise<void>;
  pedirActivar: () => Promise<boolean>;
  enviarComando: (comando: string) => Promise<void>;
  actualizarDispositivoVinculado: (
    mac: string,
    name: string,
    type?: TipoDispositivo,
    pin?: string,
    userName?: string
  ) => Promise<void>;
  actualizarPinDispositivo: (nuevoPin: string) => Promise<void>;
  actualizarNombreDispositivo: (nuevoNombre: string) => Promise<void>;
  desvincularDispositivo: () => Promise<void>;
  inicializar: () => Promise<void>;
  resetStore: () => void;
  setStatus: (status: BluetoothStatus) => void;
}

export type PocketStore = PocketState & PocketActions;

export const initialPocketState: PocketState = {
  status: 'disconnected',
  deviceMac: null,
  deviceName: null,
  deviceType: 'classic',
  devicePin: DEFAULT_SECURITY_PIN,
  cargando: true,
  tiempoRestanteBloqueo: 0,
  userName: null,
  ultimaPuerta: 'peatonal',
};

let bloqueoIntervalId: any = null;

export const usePocketStore = create<PocketStore>((set, get) => ({
  ...initialPocketState,

  setStatus: (status: BluetoothStatus) => set({ status }),

  resetStore: () => {
    if (bloqueoIntervalId) {
      clearInterval(bloqueoIntervalId);
      bloqueoIntervalId = null;
    }
    set({ ...initialPocketState });
  },

  iniciarBloqueoMargen: (segundos: number = 5) => {
    if (bloqueoIntervalId) clearInterval(bloqueoIntervalId);
    set({ tiempoRestanteBloqueo: segundos });
    bloqueoIntervalId = setInterval(() => {
      const prev = get().tiempoRestanteBloqueo;
      if (prev <= 1) {
        clearInterval(bloqueoIntervalId);
        bloqueoIntervalId = null;
        set({ tiempoRestanteBloqueo: 0 });
      } else {
        set({ tiempoRestanteBloqueo: prev - 1 });
      }
    }, 1000);
  },

  guardarNombreUsuario: async (nombre: string) => {
    const limpio = nombre.trim();
    set({ userName: limpio });
    await StorageService.saveUserName(limpio);
    const stored = await StorageService.obtenerDispositivo();
    if (stored.mac) {
      await StorageService.saveDevice(
        stored.mac,
        stored.name || t('pl_app_titulo'),
        stored.type,
        stored.pin || DEFAULT_SECURITY_PIN,
        limpio
      );
    }
  },

  guardarUltimaPuerta: async (puerta: Puerta) => {
    set({ ultimaPuerta: puerta });
    await StorageService.saveUltimaPuerta(puerta);
  },

  conectarDispositivo: async (macAddress: string, type: TipoDispositivo = 'classic') => {
    if (!macAddress) return;
    if (get().status === 'connected' && get().deviceMac === macAddress) return;

    LogService.info(`[Store] conectarDispositivo ${macAddress} (${type})`);
    set({ status: 'connecting' });
    try {
      const soportado = await BluetoothService.esSoportado();
      if (!soportado) {
        set({ status: 'disabled' });
        throw new Error('Bluetooth no soportado en este dispositivo');
      }
      const encendido = await BluetoothService.estaEncendido();
      if (!encendido) {
        set({ status: 'disabled' });
        throw new Error('Bluetooth apagado. Por favor, activa el Bluetooth');
      }
      const okPermisos = await BluetoothService.solicitarPermisos();
      if (!okPermisos) {
        set({ status: 'unauthorized' });
        throw new Error(t('pl_error_permisos'));
      }
      await BluetoothService.conectar(macAddress, type);
      set({ status: 'connected' });
      LogService.info(`[Store] Conectado a ${macAddress}`);
      sincronizarLogsConESP32().catch(() => {});
    } catch (e: any) {
      LogService.error(`[Store] No se pudo conectar a ${macAddress}`, e);
      set({ status: 'disconnected' });
      throw e;
    }
  },

  conectar: async () => {
    const { deviceMac, deviceType } = get();
    if (deviceMac) return get().conectarDispositivo(deviceMac, deviceType);
    return Promise.reject('No device paired');
  },

  desconectar: async () => {
    try {
      await BluetoothService.desconectar();
      set({ status: 'disconnected' });
    } catch (e) {
      LogService.error('Error al desconectar', e);
    }
  },

  pedirActivar: async () => {
    try {
      return await BluetoothService.pedirActivar();
    } catch (e) {
      LogService.error('[Store] pedirActivar falló', e);
      return false;
    }
  },

  enviarComando: async (comando: string) => {
    try {
      const mac = get().deviceMac || (await StorageService.getDeviceMac());
      const type = get().deviceType || (await StorageService.getDeviceType());
      const currentPin = get().devicePin || (await StorageService.getDevicePin());

      if (!mac) throw new Error(`No hay ningún dispositivo ${t('pl_app_titulo')} vinculado`);
      if (get().status !== 'connected') await get().conectarDispositivo(mac, type);

      const payload = comando.includes(':')
        ? comando
        : `PLK:${currentPin}:${comando}`;

      const respuesta = await BluetoothService.enviarComandoConRespuesta(payload, type);
      LogService.info(`[Store] Respuesta del dispositivo: ${respuesta}`);
    } catch (e: any) {
      LogService.error(`[Store] Error al enviar el comando ${enmascarar(comando)}`, e);
      if (
        e?.message?.includes('socket') ||
        e?.message?.includes('connect') ||
        e?.message?.includes('desconectado')
      ) {
        set({ status: 'disconnected' });
      }
      throw e;
    }
  },

  actualizarDispositivoVinculado: async (
    mac: string,
    name: string,
    type: TipoDispositivo = 'classic',
    pin: string = DEFAULT_SECURITY_PIN,
    user?: string
  ) => {
    const usuarioFinal = user || get().userName || (await StorageService.getUserName()) || USUARIO_POR_DEFECTO;
    try {
      await StorageService.saveDevice(mac, name, type, pin, usuarioFinal);
      set({
        deviceMac: mac,
        deviceName: name,
        deviceType: type,
        devicePin: pin,
        userName: usuarioFinal,
        status: 'disconnected',
      });
    } catch (e) {
      LogService.error('Error persistiendo dispositivo vinculado', e);
      throw e;
    }
  },

  actualizarPinDispositivo: async (nuevoPin: string) => {
    await StorageService.saveDevicePin(nuevoPin);
    set({ devicePin: nuevoPin });
  },

  actualizarNombreDispositivo: async (nuevoNombre: string) => {
    set({ deviceName: await StorageService.saveDeviceName(nuevoNombre) });
  },

  desvincularDispositivo: async () => {
    try {
      await StorageService.clearDevice();
      await BluetoothService.desconectar().catch(() => {});
      set({
        deviceMac: null,
        deviceName: null,
        devicePin: DEFAULT_SECURITY_PIN,
        status: 'unpaired',
      });
    } catch (e) {
      LogService.error('Error desvinculando dispositivo', e);
      throw e;
    }
  },

  inicializar: async () => {
    set({ deviceMac: null, deviceName: null, cargando: true });
    try {
      const [dispositivo, savedUserName, savedUltimaPuerta] = await Promise.all([
        StorageService.obtenerDispositivo(),
        StorageService.getUserName(),
        StorageService.getUltimaPuerta(),
      ]);
      const { mac, name, userName: uName, type, pin } = dispositivo;

      set({
        deviceMac: mac,
        deviceName: mac ? name : null,
        deviceType: mac ? type : 'classic',
        devicePin: mac ? pin : DEFAULT_SECURITY_PIN,
        userName: uName || savedUserName || null,
        status: mac ? 'disconnected' : 'unpaired',
        ultimaPuerta: savedUltimaPuerta,
      });
    } catch (e) {
      LogService.error('Error cargando dispositivo al inicio', e);
      set({ status: 'unpaired' });
    } finally {
      set({ cargando: false });
    }
  },
}));

export type BluetoothContextType = PocketStore;

const colaLogsRemotos: Array<{ level: string; message: string }> = [];
let reenviandoLogRemoto = false;

export async function sincronizarLogsConESP32(): Promise<void> {
  if (reenviandoLogRemoto || colaLogsRemotos.length === 0) return;
  const store = usePocketStore.getState();
  if (store.status !== 'connected') return;

  reenviandoLogRemoto = true;
  try {
    while (colaLogsRemotos.length > 0 && usePocketStore.getState().status === 'connected') {
      const item = colaLogsRemotos.shift();
      if (!item) break;
      const cleanMsg = item.message.replace(/[\r\n:]/g, ' ').trim().slice(0, 75);
      const cmd = `PLK:LOG:${item.level}:${cleanMsg}`;
      await BluetoothService.enviarComando(cmd).catch(() => {});
      await new Promise((r) => setTimeout(r, 120));
    }
  } finally {
    reenviandoLogRemoto = false;
  }
}

const BluetoothContext = createContext<BluetoothContextType | undefined>(undefined);

export function BluetoothProvider({ children }: { children: React.ReactNode }) {
  const store = usePocketStore();
  const appStateDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    usePocketStore.getState().inicializar();

    LogService.setRemoteForwarder((level, message) => {
      if (colaLogsRemotos.length >= 20) colaLogsRemotos.shift();
      colaLogsRemotos.push({ level, message });
      sincronizarLogsConESP32().catch(() => {});
    });

    const unregDesconexion = BluetoothService.registrarOnDesconexion(() => {
      usePocketStore.getState().setStatus('disconnected');
    });

    const unregDatos = BluetoothService.registrarOnDatosRecibidos((linea) => {
      LogService.info(`[RX] ${linea}`);
    });

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (appStateDebounceTimer.current) clearTimeout(appStateDebounceTimer.current);
      LogService.info(`[App] Estado de la aplicación: ${nextAppState}`);

      if (nextAppState === 'active') {
        appStateDebounceTimer.current = setTimeout(async () => {
          try {
            if (!(await BluetoothService.estaEncendido())) {
              LogService.warn('[App] Bluetooth apagado al volver a la aplicación');
              await BluetoothService.pedirActivar(false).catch((e) => LogService.warn('[App] pedirActivar(false) falló', e));
            }
          } catch (e) {
            LogService.warn('[App] No se pudo comprobar el Bluetooth al volver a la aplicación', e);
          }

          const currentStore = usePocketStore.getState();
          const mac = currentStore.deviceMac || (await StorageService.getDeviceMac());
          if (mac && (await BluetoothService.estaConectado())) {
            currentStore.setStatus('connected');
          }
        }, 300);
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        await BluetoothService.desconectar().catch(() => {});
        usePocketStore.getState().setStatus('disconnected');
      }
    };

    const appStateSub = AppState.addEventListener('change', handleAppStateChange);

    let onEnabledSub: any = null;
    let onDisabledSub: any = null;

    try {
      if (NativeModules.RNBluetoothClassic && (RNBluetoothClassic as any)._nativeModule) {
        onEnabledSub = RNBluetoothClassic.onBluetoothEnabled(async () => {
          LogService.info('[Bluetooth] El Bluetooth se ha encendido');
          const currentStore = usePocketStore.getState();
          const mac = currentStore.deviceMac || (await StorageService.getDeviceMac());
          currentStore.setStatus(mac ? 'disconnected' : 'unpaired');
        });

        onDisabledSub = RNBluetoothClassic.onBluetoothDisabled(() => {
          LogService.warn('[Bluetooth] El Bluetooth se ha apagado');
          usePocketStore.getState().setStatus('disabled');
        });
      }
    } catch (e) {
      LogService.warn('[Bluetooth] No se pudieron registrar los listeners de estado', e);
    }

    return () => {
      if (appStateDebounceTimer.current) clearTimeout(appStateDebounceTimer.current);
      appStateSub?.remove?.();
      onEnabledSub?.remove?.();
      onDisabledSub?.remove?.();
      unregDesconexion();
      unregDatos();
      LogService.setRemoteForwarder(null);
      usePocketStore.getState().resetStore();
    };
  }, []);

  return <BluetoothContext.Provider value={store}>{children}</BluetoothContext.Provider>;
}

export function useBluetooth(): BluetoothContextType {
  const context = useContext(BluetoothContext);
  if (context === undefined) {
    throw new Error('useBluetooth debe ser usado dentro de un BluetoothProvider');
  }
  return context;
}

export default BluetoothService;
