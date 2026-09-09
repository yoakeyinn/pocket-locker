import React, { createContext, useContext, useEffect, useRef } from 'react';
import { Platform, PermissionsAndroid, NativeModules, Linking, AppState, AppStateStatus } from 'react-native';
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import { BleManager, Device } from 'react-native-ble-plx';
import { create } from 'zustand';
import StorageService, { LogService, DEFAULT_SECURITY_PIN, parsearYValidarPin } from './StorageService';

// =============================================================================
// 1. CONSTANTES Y TIPOS BLUETOOTH
// =============================================================================

const NUS_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_RX_UUID      = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_TX_UUID      = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

export type TipoConexion = 'ble' | 'classic' | null;

export interface DispositivoBT {
  name: string;
  address: string;
  bleMac?: string;
  type: 'classic' | 'ble';
}

export type BluetoothStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'unauthorized'
  | 'disabled'
  | 'unpaired';

// =============================================================================
// 2. CONTROLADOR NATIVO BLUETOOTH (BLE GATT + CLASSIC SPP)
// =============================================================================

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
      if (apiLevel >= 31) {
        const perms = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ];
        if (apiLevel >= 34) perms.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE);
        const statuses = await PermissionsAndroid.requestMultiple(perms);
        return (
          statuses[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
          statuses[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
        );
      }
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ]);
      return (
        granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED ||
        granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED
      );
    } catch (e: any) {
      LogService.error('[Bluetooth] Error en solicitud de permisos', e);
      return false;
    }
  }

  async esSoportado(): Promise<boolean> {
    if (NativeModules.RNBluetoothClassic) {
      try {
        const ok = await RNBluetoothClassic.isBluetoothAvailable();
        if (ok) return true;
      } catch {}
    }
    return !!this.getBleManager();
  }

  async estaEncendido(): Promise<boolean> {
    if (NativeModules.RNBluetoothClassic) {
      try {
        const encendido = await RNBluetoothClassic.isBluetoothEnabled();
        if (encendido) return true;
      } catch {}
    }
    const mgr = this.getBleManager();
    if (mgr) {
      try {
        const state = await mgr.state();
        return state === 'PoweredOn';
      } catch {}
    }
    return false;
  }

  async pedirActivar(): Promise<boolean> {
    if (Platform.OS === 'android' && NativeModules.RNBluetoothClassic) {
      try {
        return await RNBluetoothClassic.requestBluetoothEnabled();
      } catch (e) {
        LogService.warn('[Bluetooth] requestBluetoothEnabled falló', e);
      }
    }
    return this.abrirAjustesBluetooth().then(() => false);
  }

  async abrirAjustesBluetooth(): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        const IntentLauncher = NativeModules.IntentLauncher || NativeModules.ExpoIntentLauncher;
        if (IntentLauncher?.startActivity) {
          await IntentLauncher.startActivity({ action: 'android.settings.BLUETOOTH_SETTINGS' });
          return;
        }
      }
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

  async abrirAjustesUbicacion(): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        const IntentLauncher = NativeModules.IntentLauncher || NativeModules.ExpoIntentLauncher;
        if (IntentLauncher?.startActivity) {
          await IntentLauncher.startActivity({ action: 'android.settings.LOCATION_SOURCE_SETTINGS' });
          return;
        }
      }
      await Linking.openSettings();
    } catch (e) {
      LogService.warn('Error al abrir configuración de ubicación', e);
      Linking.openSettings().catch(() => {});
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
    if (!mgr) return null;

    return new Promise((resolve) => {
      let encontrado = false;
      const timer = setTimeout(() => {
        if (!encontrado) {
          mgr.stopDeviceScan();
          resolve(null);
        }
      }, timeoutMs);

      mgr.startDeviceScan(null, null, (error: any, device: Device | null) => {
        if (error) {
          mgr.stopDeviceScan();
          clearTimeout(timer);
          resolve(null);
          return;
        }
        if (device && (device.name === 'PLBT' || device.localName === 'PLBT')) {
          encontrado = true;
          mgr.stopDeviceScan();
          clearTimeout(timer);
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

    this.bleDevice = await mgr.connectToDevice(targetId, { timeout: 12000, autoConnect: false });
    await this.bleDevice.discoverAllServicesAndCharacteristics();

    const services = await this.bleDevice.services();
    if (!services.some((s) => s.uuid.toLowerCase() === NUS_SERVICE_UUID)) {
      throw new Error(`Servicio Nordic UART (${NUS_SERVICE_UUID}) no encontrado`);
    }

    this.limpiarSuscripcionesBLE();
    this.bleDisconnectSubscription = mgr.onDeviceDisconnected(targetId, () => {
      this.bleDevice = null;
      this.limpiarSuscripcionesBLE();
      onDesconexion();
    });

    this.bleTxSubscription = this.bleDevice.monitorCharacteristicForService(
      NUS_SERVICE_UUID,
      NUS_TX_UUID,
      (error, characteristic) => {
        if (!error && characteristic?.value) {
          onDatos(this.fromBase64(characteristic.value));
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
      this.toBase64(payload)
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
      return await RNBluetoothClassic.getBondedDevices();
    } catch {
      return [];
    }
  }

  async vincularDispositivo(address: string): Promise<boolean> {
    if (!NativeModules.RNBluetoothClassic) return false;
    try {
      const dev = await RNBluetoothClassic.pairDevice(address);
      return !!dev;
    } catch {
      return false;
    }
  }

  async desvincularDispositivo(address: string): Promise<boolean> {
    if (!NativeModules.RNBluetoothClassic) return false;
    try {
      if (typeof (RNBluetoothClassic as any).unpairDevice === 'function') {
        return await (RNBluetoothClassic as any).unpairDevice(address);
      }
      return true;
    } catch {
      return false;
    }
  }

  async cancelarDescubrimiento(): Promise<void> {
    if (NativeModules.RNBluetoothClassic) {
      try { await RNBluetoothClassic.cancelDiscovery(); } catch {}
    }
    try { this.getBleManager()?.stopDeviceScan(); } catch {}
  }

  async listarDispositivos(
    onDispositivoEncontrado?: (dev: DispositivoBT) => void,
    duracionMs: number = 6000
  ): Promise<DispositivoBT[]> {
    const okPermisos = await this.solicitarPermisos();
    if (!okPermisos) throw new Error('Permisos de Bluetooth no concedidos');

    await this.cancelarDescubrimiento();
    await new Promise((r) => setTimeout(r, 300));

    const mapa = new Map<string, DispositivoBT>();
    const emitir = (dev: DispositivoBT) => {
      const k = dev.address.toLowerCase();
      const prev = mapa.get(k);
      if (prev) {
        if ((!prev.name || prev.name === 'Sin nombre') && dev.name && dev.name !== 'Sin nombre') {
          prev.name = dev.name;
          onDispositivoEncontrado?.(prev);
        }
        return;
      }
      mapa.set(k, dev);
      onDispositivoEncontrado?.(dev);
    };

    if (NativeModules.RNBluetoothClassic) {
      try {
        const conectados = await RNBluetoothClassic.getConnectedDevices();
        conectados?.forEach((c: any) => c?.address && emitir({ name: c.name || 'Sin nombre', address: c.address, type: 'classic' }));
      } catch {}

      try {
        const bonded = await RNBluetoothClassic.getBondedDevices();
        bonded?.forEach((b: any) => {
          const u = (b?.name || '').toUpperCase();
          if (b?.address && (u.includes('PLBT') || u.includes('POCKET') || u.includes('ESP32'))) {
            emitir({ name: b.name || 'PLBT', address: b.address, type: 'classic' });
          }
        });
      } catch {}
    }

    let subClassic: any = null;
    let classicP: Promise<any> = Promise.resolve([]);

    if (NativeModules.RNBluetoothClassic) {
      try {
        if (typeof (RNBluetoothClassic as any).onDeviceDiscovered === 'function') {
          subClassic = (RNBluetoothClassic as any).onDeviceDiscovered((ev: any) => {
            if (ev?.device?.address) {
              emitir({ name: ev.device.name || 'Sin nombre', address: ev.device.address, type: 'classic' });
            }
          });
        }
        classicP = RNBluetoothClassic.startDiscovery().catch(() => []);
      } catch {}
    }

    const bleMgr = this.getBleManager();
    if (bleMgr) {
      try {
        bleMgr.startDeviceScan(null, null, (err, bDev) => {
          if (!err && bDev?.id) {
            emitir({ name: bDev.name || bDev.localName || 'Dispositivo BLE', address: bDev.id, type: 'ble' });
          }
        });
      } catch {}
    }

    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, duracionMs);
      classicP.finally(() => { clearTimeout(t); resolve(); });
    });

    try { subClassic?.remove?.(); } catch {}
    await this.cancelarDescubrimiento();

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
    await this.cancelarDescubrimiento();
    await new Promise((r) => setTimeout(r, 600));

    const bonded = await this.getBondedDevices();
    if (!bonded.some((d) => d.address.toUpperCase() === mac.toUpperCase())) {
      const emparejado = await Promise.race([
        this.vincularDispositivo(mac),
        new Promise<boolean>((r) => setTimeout(() => r(false), 6000)),
      ]);
      if (!emparejado) throw new Error('No se pudo emparejar el dispositivo Classic');
    }

    let err1 = '';
    try {
      await this._intentoSocketClassic(mac, { secure: false, secureSocket: false, delimiter: '\n' });
      this.configurarMonitoreoClassic(this.classicDevice, mac, onDesconexion, onDatos);
      return;
    } catch (e: any) {
      err1 = e?.message || String(e);
      if (err1.toLowerCase().includes('already')) {
        try {
          const conectados = await RNBluetoothClassic.getConnectedDevices();
          const d = conectados.find((x) => x.address.toUpperCase() === mac.toUpperCase());
          if (d && (await d.isConnected().catch(() => false))) {
            this.classicDevice = d;
            this.configurarMonitoreoClassic(this.classicDevice, mac, onDesconexion, onDatos);
            return;
          }
        } catch {}
      }
    }

    await new Promise((r) => setTimeout(r, 800));

    try {
      await this._intentoSocketClassic(mac, { secure: true, secureSocket: true, delimiter: '\n' });
      this.configurarMonitoreoClassic(this.classicDevice, mac, onDesconexion, onDatos);
    } catch (err2: any) {
      const msgErr2 = err2?.message || String(err2);
      const combined = `${err1} | ${msgErr2}`.toLowerCase();
      if (
        combined.includes('securityexception') ||
        combined.includes('lacks permission') ||
        combined.includes('permission')
      ) {
        throw new Error('Falta permiso de Bluetooth en el sistema. Por favor, abre los Ajustes de la aplicación y concede los permisos de Bluetooth y Dispositivos cercanos.');
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
    mac: string,
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

  private notificarDesconexion(): void {
    if (this.onDesconexionCallback) this.onDesconexionCallback();
  }

  private notificarDatos(data: string): void {
    if (this.onDatosCallback) this.onDatosCallback(data);
  }

  async conectar(macOrBleId: string, type: 'classic' | 'ble' = 'classic'): Promise<void> {
    await this.desconectar();
    const onDesc = () => this.notificarDesconexion();
    const onDat = (d: string) => this.notificarDatos(d);

    if (type === 'ble') {
      try {
        const idConectado = await this.conectarBLE(macOrBleId, onDesc, onDat);
        this.tipoActivo = 'ble';
        this.bleMacCache.set(macOrBleId, idConectado);
      } catch (bleErr: any) {
        if (NativeModules.RNBluetoothClassic) {
          await this.conectarClassic(macOrBleId, onDesc, onDat);
          this.tipoActivo = 'classic';
        } else {
          throw bleErr;
        }
      }
    } else {
      try {
        await this.conectarClassic(macOrBleId, onDesc, onDat);
        this.tipoActivo = 'classic';
      } catch (classicErr: any) {
        const cachedBleId = this.bleMacCache.get(macOrBleId) || null;
        try {
          const idConectado = await this.conectarBLE(cachedBleId, onDesc, onDat);
          this.tipoActivo = 'ble';
          this.bleMacCache.set(macOrBleId, idConectado);
        } catch {
          throw classicErr;
        }
      }
    }
  }

  async desconectar(): Promise<void> {
    this.tipoActivo = null;
    this.limpiarSuscripcionesBLE();
    this.limpiarSuscripcionesClassic();

    if (this.bleDevice) {
      try { await this.bleDevice.cancelConnection(); } catch {}
      this.bleDevice = null;
    }
    if (this.classicDevice) {
      try { await this.classicDevice.disconnect(); } catch {}
      this.classicDevice = null;
    }
  }

  async estaConectado(type?: 'classic' | 'ble'): Promise<boolean> {
    if (type === 'classic') return this.classicDevice ? await this.classicDevice.isConnected().catch(() => false) : false;
    if (type === 'ble') return this.bleDevice ? await this.bleDevice.isConnected().catch(() => false) : false;
    const cOk = this.classicDevice ? await this.classicDevice.isConnected().catch(() => false) : false;
    const bOk = this.bleDevice ? await this.bleDevice.isConnected().catch(() => false) : false;
    return cOk || bOk;
  }

  async enviarComando(comando: string, type?: 'classic' | 'ble'): Promise<void> {
    const payload = comando.endsWith('\n') ? comando : comando + '\n';
    const destino = type || this.tipoActivo;

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
    type?: 'classic' | 'ble',
    timeoutMs = 4000
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let timer: NodeJS.Timeout | null = null;
      const callbackPrevio = this.onDatosCallback;

      const limpiar = () => {
        if (timer) clearTimeout(timer);
        this.onDatosCallback = callbackPrevio;
      };

      timer = setTimeout(() => {
        limpiar();
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

  private toBase64(str: string): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let output = '';
    for (let i = 0; i < str.length; i += 3) {
      const c1 = str.charCodeAt(i) & 0xff;
      const c2 = i + 1 < str.length ? str.charCodeAt(i + 1) & 0xff : 0;
      const c3 = i + 2 < str.length ? str.charCodeAt(i + 2) & 0xff : 0;
      output += chars.charAt(c1 >> 2) +
                chars.charAt(((c1 & 3) << 4) | (c2 >> 4)) +
                (i + 1 >= str.length ? '=' : chars.charAt(((c2 & 15) << 2) | (c3 >> 6))) +
                (i + 2 >= str.length ? '=' : chars.charAt(c3 & 63));
    }
    return output;
  }

  private fromBase64(b64: string): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let output = '';
    const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '');
    for (let i = 0; i < clean.length; i += 4) {
      const b1 = chars.indexOf(clean.charAt(i));
      const b2 = chars.indexOf(clean.charAt(i + 1));
      const b3 = chars.indexOf(clean.charAt(i + 2));
      const b4 = chars.indexOf(clean.charAt(i + 3));
      output += String.fromCharCode((b1 << 2) | (b2 >> 4));
      if (b3 !== -1 && clean.charAt(i + 2) !== '=') output += String.fromCharCode(((b2 & 15) << 4) | (b3 >> 2));
      if (b4 !== -1 && clean.charAt(i + 3) !== '=') output += String.fromCharCode(((b3 & 3) << 6) | b4);
    }
    return output;
  }
}

export const BluetoothService = new BluetoothServiceClass();

// =============================================================================
// 3. STORE GLOBAL REACTIVO (ZUSTAND)
// =============================================================================

export interface PocketState {
  status: BluetoothStatus;
  deviceName: string | null;
  deviceMac: string | null;
  deviceType: 'classic' | 'ble';
  devicePin: string;
  cargando: boolean;
  tiempoRestanteBloqueo: number;
  userName: string | null;
  ultimaPuerta: 'peatonal' | 'garaje';
  userRole: 'admin' | 'user';
  permisos: { peatonal: boolean; garaje: boolean };
  diasRestantes: number | null;
}

export interface PocketActions {
  iniciarBloqueoMargen: (segundos?: number) => void;
  guardarNombreUsuario: (nombre: string) => Promise<void>;
  guardarUltimaPuerta: (puerta: 'peatonal' | 'garaje') => Promise<void>;
  conectar: () => Promise<void>;
  conectarDispositivo: (macAddress: string, type?: 'classic' | 'ble') => Promise<void>;
  desconectar: () => Promise<void>;
  pedirActivar: () => Promise<boolean>;
  enviarComando: (comando: string) => Promise<void>;
  actualizarDispositivoVinculado: (
    mac: string,
    name: string,
    type?: 'classic' | 'ble',
    pin?: string,
    userName?: string
  ) => Promise<void>;
  actualizarPinDispositivo: (nuevoPin: string) => Promise<void>;
  actualizarNombreDispositivo: (nuevoNombre: string) => Promise<void>;
  desvincularDispositivo: () => Promise<void>;
  inicializar: () => Promise<void>;
  resetStore: () => void;
  setStatus: (status: BluetoothStatus) => void;
  setCargando: (cargando: boolean) => void;
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
  userRole: 'user',
  permisos: { peatonal: true, garaje: true },
  diasRestantes: null,
};

let bloqueoIntervalId: any = null;

export const usePocketStore = create<PocketStore>((set, get) => ({
  ...initialPocketState,

  setStatus: (status: BluetoothStatus) => set({ status }),
  setCargando: (cargando: boolean) => set({ cargando }),

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
        stored.name || 'Pocket Locker',
        stored.type,
        stored.pin || DEFAULT_SECURITY_PIN,
        limpio
      );
    }
  },

  guardarUltimaPuerta: async (puerta: 'peatonal' | 'garaje') => {
    set({ ultimaPuerta: puerta });
    await StorageService.saveUltimaPuerta(puerta);
  },

  conectarDispositivo: async (macAddress: string, type: 'classic' | 'ble' = 'classic') => {
    if (!macAddress) return;
    if (get().status === 'connected' && get().deviceMac === macAddress) return;

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
        throw new Error('Permisos de Bluetooth o dispositivos cercanos no concedidos');
      }
      await BluetoothService.conectar(macAddress, type);
      set({ status: 'connected' });
      sincronizarLogsConESP32().catch(() => {});
    } catch (e: any) {
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
    } catch {
      return false;
    }
  },

  enviarComando: async (comando: string) => {
    try {
      const mac = get().deviceMac || (await StorageService.getDeviceMac());
      const type = get().deviceType || (await StorageService.getDeviceType());
      const currentPin = get().devicePin || (await StorageService.getDevicePin());

      if (!mac) throw new Error('No hay ningún dispositivo Pocket Locker vinculado');
      if (get().status !== 'connected') await get().conectarDispositivo(mac, type);

      const payload = comando.startsWith('PLK:') || comando.includes(':')
        ? comando
        : `PLK:${currentPin}:${comando}`;

      await BluetoothService.enviarComandoConRespuesta(payload, type);
    } catch (e: any) {
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
    type: 'classic' | 'ble' = 'classic',
    pin: string = DEFAULT_SECURITY_PIN,
    user?: string
  ) => {
    const usuarioFinal = user || get().userName || (await StorageService.getUserName()) || 'Usuario';
    const parsed = parsearYValidarPin(pin);
    try {
      await StorageService.saveDevice(mac, name, type, pin, usuarioFinal);
      set({
        deviceMac: mac,
        deviceName: name,
        deviceType: type,
        devicePin: pin,
        userName: usuarioFinal,
        status: 'disconnected',
        userRole: parsed.esAdmin ? 'admin' : 'user',
        permisos: { peatonal: parsed.peatonal, garaje: parsed.garaje },
        diasRestantes: parsed.dias,
      });
    } catch (e) {
      LogService.error('Error persistiendo dispositivo vinculado', e);
      throw e;
    }
  },

  actualizarPinDispositivo: async (nuevoPin: string) => {
    const parsed = parsearYValidarPin(nuevoPin);
    await StorageService.saveDevicePin(nuevoPin);
    set({
      devicePin: nuevoPin,
      userRole: parsed.esAdmin ? 'admin' : 'user',
      permisos: { peatonal: parsed.peatonal, garaje: parsed.garaje },
      diasRestantes: parsed.dias,
    });
  },

  actualizarNombreDispositivo: async (nuevoNombre: string) => {
    const limpio = nuevoNombre.trim() || 'Pocket Locker';
    await StorageService.saveDeviceName(limpio);
    set({ deviceName: limpio });
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
        userRole: 'user',
        permisos: { peatonal: true, garaje: true },
        diasRestantes: null,
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
      const { mac, name, userName: uName, type, pin, role, permisos, diasRestantes } = dispositivo;
      const effectiveUser = uName || savedUserName || null;

      if (mac) {
        set({
          deviceMac: mac,
          deviceName: name,
          deviceType: type || 'classic',
          devicePin: pin || DEFAULT_SECURITY_PIN,
          userName: effectiveUser,
          status: 'disconnected',
          ultimaPuerta: savedUltimaPuerta || 'peatonal',
          userRole: role || 'user',
          permisos: permisos || { peatonal: true, garaje: true },
          diasRestantes: diasRestantes ?? null,
        });
      } else {
        set({
          deviceMac: null,
          deviceName: null,
          deviceType: 'classic',
          devicePin: DEFAULT_SECURITY_PIN,
          userName: effectiveUser,
          status: 'unpaired',
          ultimaPuerta: savedUltimaPuerta || 'peatonal',
          userRole: 'user',
          permisos: { peatonal: true, garaje: true },
          diasRestantes: null,
        });
      }
    } catch (e) {
      LogService.error('Error cargando dispositivo al inicio', e);
      set({ status: 'unpaired' });
    } finally {
      set({ cargando: false });
    }
  },
}));

// =============================================================================
// 4. CONTEXTO REACT Y CICLO DE VIDA (BLUETOOTH PROVIDER)
// =============================================================================

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
  const appStateDebounceTimer = useRef<NodeJS.Timeout | null>(null);

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

      if (nextAppState === 'active') {
        appStateDebounceTimer.current = setTimeout(async () => {
          try {
            if (!(await BluetoothService.estaEncendido())) {
              await BluetoothService.pedirActivar().catch(() => {});
            }
          } catch {}

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

    if (NativeModules.RNBluetoothClassic && (RNBluetoothClassic as any)._nativeModule) {
      onEnabledSub = RNBluetoothClassic.onBluetoothEnabled(async () => {
        const currentStore = usePocketStore.getState();
        const mac = currentStore.deviceMac || (await StorageService.getDeviceMac());
        currentStore.setStatus(mac ? 'disconnected' : 'unpaired');
      });

      onDisabledSub = RNBluetoothClassic.onBluetoothDisabled(() => {
        usePocketStore.getState().setStatus('disabled');
      });
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
