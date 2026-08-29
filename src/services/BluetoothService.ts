import RNBluetoothClassic, {
  BluetoothDevice,
} from 'react-native-bluetooth-classic';
import { BleManager, Device } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform, NativeModules } from 'react-native';

export interface DispositivoBT {
  name: string;
  address: string;
  type: 'classic' | 'ble';
}

class BluetoothServiceClass {
  private bleManager: BleManager | null = null;
  private dispositivoConectadoClassic: BluetoothDevice | null = null;
  private dispositivoConectadoBle: Device | null = null;
  private onDesconexionCallback: (() => void) | null = null;
  private disconnectSubscription: any = null;

  /**
   * Comprueba si el módulo nativo de Bluetooth Clásico está disponible.
   */
  private esClassicDisponible(): boolean {
    try {
      return !!NativeModules.RNBluetoothClassic;
    } catch {
      return false;
    }
  }

  /**
   * Registra una función de retorno para cuando el dispositivo BLE conectado se desconecta de forma inesperada.
   */
  registrarOnDesconexion(callback: () => void) {
    this.onDesconexionCallback = callback;
  }

  /**
   * Configura la escucha activa de desconexión para el dispositivo BLE.
   */
  private registrarMonitoreoDesconexion(device: Device) {
    if (this.disconnectSubscription) {
      try {
        this.disconnectSubscription.remove();
      } catch (e) {
        // Ignorar
      }
    }

    const manager = this.getBleManager();
    if (!manager) return;

    this.disconnectSubscription = manager.onDeviceDisconnected(device.id, (error, disconnectedDevice) => {
      console.log('[BLE] Dispositivo desconectado activamente:', disconnectedDevice?.id);
      if (this.onDesconexionCallback) {
        this.onDesconexionCallback();
      }
      this.dispositivoConectadoBle = null;
    });
  }

  /**
   * Obtiene la instancia de BleManager de forma perezosa y segura.
   */
  private getBleManager(): BleManager | null {
    try {
      if (!this.bleManager) {
        this.bleManager = new BleManager();
      }
      return this.bleManager;
    } catch (e) {
      console.warn('[BLE] El módulo react-native-ble-plx no está disponible', e);
      return null;
    }
  }

  /**
   * Solicita los permisos necesarios en Android.
   */
  async solicitarPermisos(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      const apiLevel = typeof Platform.Version === 'number'
        ? Platform.Version
        : parseInt(String(Platform.Version), 10);

      if (apiLevel >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        return (
          granted['android.permission.BLUETOOTH_SCAN'] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          granted['android.permission.BLUETOOTH_CONNECT'] ===
            PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (e) {
      console.warn('Error solicitando permisos BT', e);
      return false;
    }
  }

  /**
   * Comprueba si el dispositivo soporta Bluetooth.
   */
  async esSoportado(): Promise<boolean> {
    // Si BLE está disponible, consideramos que es soportado (soporta BLE en iOS/Android)
    if (this.getBleManager() !== null) {
      return true;
    }
    // Si no, comprobamos soporte de Classic de forma segura
    if (this.esClassicDisponible()) {
      try {
        return await RNBluetoothClassic.isBluetoothAvailable();
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  /**
   * Comprueba si el Bluetooth está activado.
   */
  async estaEncendido(): Promise<boolean> {
    // Comprobación con Classic en Android
    if (this.esClassicDisponible()) {
      try {
        const activeClassic = await RNBluetoothClassic.isBluetoothEnabled();
        if (activeClassic) return true;
      } catch (e) {
        // Ignorar
      }
    }

    // Comprobación alternativa con BLE
    const manager = this.getBleManager();
    if (manager) {
      try {
        const state = await manager.state();
        return state === 'PoweredOn';
      } catch (e) {
        return false;
      }
    }

    return false;
  }

  /**
   * Solicita al sistema activar el Bluetooth.
   */
  async pedirActivar(): Promise<boolean> {
    if (this.esClassicDisponible()) {
      try {
        return await RNBluetoothClassic.requestBluetoothEnabled();
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  /**
   * Devuelve los dispositivos emparejados + descubre nuevos cercanos (Clásicos y BLE).
   */
  async listarDispositivos(): Promise<DispositivoBT[]> {
    const okPermisos = await this.solicitarPermisos();
    if (!okPermisos) {
      throw new Error('Permisos de Bluetooth no concedidos');
    }

    // Cancelar cualquier escaneo o descubrimiento previo para evitar colisiones y fugas
    await this.cancelarDescubrimiento();

    const mapa = new Map<string, DispositivoBT>();

    // 1. Obtener dispositivos emparejados clásicos (Solo Android si Classic está disponible)
    if (this.esClassicDisponible()) {
      try {
        const emparejados = await RNBluetoothClassic.getBondedDevices();
        emparejados.forEach((d) => {
          mapa.set(d.address.toLowerCase(), {
            name: d.name || 'Sin nombre',
            address: d.address,
            type: 'classic',
          });
        });
      } catch (e) {
        console.warn('Error obteniendo dispositivos emparejados clásicos', e);
      }
    }

    // 2. Escaneos en paralelo (Descubrimiento Clásico y Escaneo BLE)
    const promesas: Promise<void>[] = [];

    // Classic Discovery (Solo Android, si está disponible)
    if (this.esClassicDisponible()) {
      promesas.push(
        (async () => {
          try {
            const descubiertos = await RNBluetoothClassic.startDiscovery();
            descubiertos.forEach((d) => {
              const key = d.address.toLowerCase();
              if (!mapa.has(key)) {
                mapa.set(key, {
                  name: d.name || 'Sin nombre',
                  address: d.address,
                  type: 'classic',
                });
              }
            });
          } catch (e) {
            console.warn('Error en discovery clásico', e);
          }
        })()
      );
    }

    // BLE Scan (iOS y Android)
    const manager = this.getBleManager();
    if (manager) {
      promesas.push(
        new Promise<void>((resolve) => {
          const bleDiscovered = new Map<string, Device>();

          manager.startDeviceScan(null, null, (error, device) => {
            if (error) {
              console.warn('Error en escaneo BLE', error);
              resolve();
              return;
            }
            if (device) {
              const name = device.name || device.localName || 'Dispositivo BLE';
              const key = device.id.toLowerCase();
              bleDiscovered.set(key, device);
            }
          });

          // Limitar escaneo BLE a 4 segundos
          setTimeout(() => {
            try {
              manager.stopDeviceScan();
            } catch (e) {
              console.warn('Error al detener escaneo BLE', e);
            }

            bleDiscovered.forEach((device, key) => {
              if (!mapa.has(key)) {
                mapa.set(key, {
                  name: device.name || device.localName || 'Sin nombre (BLE)',
                  address: device.id,
                  type: 'ble',
                });
              }
            });
            resolve();
          }, 4000);
        })
      );
    }

    await Promise.all(promesas);

    return Array.from(mapa.values());
  }

  /**
   * Conecta al dispositivo indicado según su tipo.
   */
  async conectar(address: string, type: 'classic' | 'ble' = 'classic'): Promise<void> {
    await this.cancelarDescubrimiento();

    if (type === 'classic') {
      if (!this.esClassicDisponible()) {
        throw new Error('El módulo nativo de Bluetooth Clásico no está disponible en este dispositivo');
      }

      try {
        if (
          this.dispositivoConectadoClassic &&
          this.dispositivoConectadoClassic.address === address
        ) {
          const sigueConectado = await this.dispositivoConectadoClassic.isConnected();
          if (sigueConectado) return;
        }

        const device = await RNBluetoothClassic.connectToDevice(address, {
          delimiter: '\n',
        });
        this.dispositivoConectadoClassic = device;
      } catch (e: any) {
        this.dispositivoConectadoClassic = null;
        throw new Error(
          `No se pudo conectar al dispositivo clásico: ${e?.message || 'desconocido'}`,
        );
      }
    } else {
      const manager = this.getBleManager();
      if (!manager) {
        throw new Error('Servicio BLE no disponible en este dispositivo');
      }

      try {
        if (
          this.dispositivoConectadoBle &&
          this.dispositivoConectadoBle.id === address
        ) {
          const sigueConectado = await this.dispositivoConectadoBle.isConnected();
          if (sigueConectado) return;
        }

        const device = await manager.connectToDevice(address);
        await device.discoverAllServicesAndCharacteristics();
        this.dispositivoConectadoBle = device;

        // Registrar monitoreo activo de desconexión
        this.registrarMonitoreoDesconexion(device);
      } catch (e: any) {
        this.dispositivoConectadoBle = null;
        throw new Error(
          `No se pudo conectar al dispositivo BLE: ${e?.message || 'desconocido'}`,
        );
      }
    }
  }

  /**
   * Envía un comando de texto al dispositivo conectado.
   */
  async enviarComando(comando: string, type: 'classic' | 'ble' = 'classic'): Promise<void> {
    if (type === 'classic') {
      if (!this.esClassicDisponible()) {
        throw new Error('El módulo nativo de Bluetooth Clásico no está disponible en este dispositivo');
      }
      if (!this.dispositivoConectadoClassic) {
        throw new Error('No hay dispositivo Clásico conectado');
      }
      try {
        await this.dispositivoConectadoClassic.write(comando);
      } catch (e: any) {
        throw new Error(
          `No se pudo enviar el comando clásico: ${e?.message || 'desconocido'}`,
        );
      }
    } else {
      if (!this.dispositivoConectadoBle) {
        throw new Error('No hay dispositivo BLE conectado');
      }
      try {
        const writeDetails = await this.encontrarCaracteristicaEscritura(this.dispositivoConectadoBle);
        if (!writeDetails) {
          throw new Error('No se encontró ninguna característica de escritura en el dispositivo BLE');
        }

        const base64Comando = this.toBase64(comando);
        if (writeDetails.isWritableWithoutResponse) {
          await this.dispositivoConectadoBle.writeCharacteristicWithoutResponseForService(
            writeDetails.serviceUUID,
            writeDetails.characteristicUUID,
            base64Comando
          );
        } else {
          await this.dispositivoConectadoBle.writeCharacteristicWithResponseForService(
            writeDetails.serviceUUID,
            writeDetails.characteristicUUID,
            base64Comando
          );
        }
      } catch (e: any) {
        throw new Error(
          `No se pudo enviar el comando BLE: ${e?.message || 'desconocido'}`,
        );
      }
    }
  }

  /**
   * Desconecta el dispositivo activo.
   */
  async desconectar(): Promise<void> {
    if (this.disconnectSubscription) {
      try {
        this.disconnectSubscription.remove();
      } catch (e) {
        // Ignorar
      }
      this.disconnectSubscription = null;
    }

    if (this.esClassicDisponible() && this.dispositivoConectadoClassic) {
      try {
        await this.dispositivoConectadoClassic.disconnect();
      } catch (e) {
        console.warn('Error al desconectar clásico', e);
      } finally {
        this.dispositivoConectadoClassic = null;
      }
    }

    if (this.dispositivoConectadoBle) {
      try {
        await this.dispositivoConectadoBle.cancelConnection();
      } catch (e) {
        console.warn('Error al desconectar BLE', e);
      } finally {
        this.dispositivoConectadoBle = null;
      }
    }
  }

  /**
   * Indica si actualmente hay conexión activa.
   */
  async estaConectado(type: 'classic' | 'ble' = 'classic'): Promise<boolean> {
    if (type === 'classic') {
      if (!this.esClassicDisponible() || !this.dispositivoConectadoClassic) return false;
      try {
        return await this.dispositivoConectadoClassic.isConnected();
      } catch {
        return false;
      }
    } else {
      if (!this.dispositivoConectadoBle) return false;
      try {
        return await this.dispositivoConectadoBle.isConnected();
      } catch {
        return false;
      }
    }
  }

  /**
   * Cancela el descubrimiento activo de dispositivos.
   */
  async cancelarDescubrimiento(): Promise<void> {
    if (this.esClassicDisponible()) {
      try {
        await RNBluetoothClassic.cancelDiscovery();
      } catch (e) {
        console.warn('Error al cancelar discovery clásico', e);
      }
    }
    try {
      const manager = this.getBleManager();
      if (manager) {
        manager.stopDeviceScan();
      }
    } catch (e) {
      console.warn('Error al cancelar discovery BLE', e);
    }
  }

  /**
   * Encuentra de forma genérica la primera característica escribible.
   */
  private async encontrarCaracteristicaEscritura(device: Device): Promise<{
    serviceUUID: string;
    characteristicUUID: string;
    isWritableWithoutResponse: boolean;
  } | null> {
    try {
      const services = await device.services();
      for (const service of services) {
        const characteristics = await service.characteristics();
        for (const char of characteristics) {
          if (char.isWritableWithResponse || char.isWritableWithoutResponse) {
            return {
              serviceUUID: service.uuid,
              characteristicUUID: char.uuid,
              isWritableWithoutResponse: char.isWritableWithoutResponse,
            };
          }
        }
      }
      return null;
    } catch (e) {
      console.warn('Error buscando características de escritura', e);
      return null;
    }
  }

  /**
   * Convierte un string a Base64 sin dependencias nativas externas.
   */
  private toBase64(str: string): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let output = '';
    for (let i = 0; i < str.length; i += 3) {
      const c1 = str.charCodeAt(i);
      const c2 = i + 1 < str.length ? str.charCodeAt(i + 1) : NaN;
      const c3 = i + 2 < str.length ? str.charCodeAt(i + 2) : NaN;
      const byte1 = c1 >> 2;
      const byte2 = ((c1 & 3) << 4) | (isNaN(c2) ? 0 : c2 >> 4);
      const byte3 = isNaN(c2) ? 64 : ((c2 & 15) << 2) | (isNaN(c3) ? 0 : c3 >> 6);
      const byte4 = isNaN(c3) ? 64 : c3 & 63;
      output += chars.charAt(byte1) + chars.charAt(byte2) + chars.charAt(byte3) + chars.charAt(byte4);
    }
    return output;
  }
}

const BluetoothService = new BluetoothServiceClass();
export default BluetoothService;
