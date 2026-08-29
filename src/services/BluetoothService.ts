import RNBluetoothClassic, {
  BluetoothDevice,
} from 'react-native-bluetooth-classic';
import { BleManager, Device } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform, NativeModules } from 'react-native';

/**
 * Representación unificada de un dispositivo Bluetooth detectado (Clásico o BLE).
 */
export interface DispositivoBT {
  name: string;
  address: string;
  type: 'classic' | 'ble';
}

/**
 * Servicio centralizado para la gestión de comunicaciones Bluetooth.
 * Soporta de forma transparente:
 * - Bluetooth Clásico (RFCOMM / SPP) mediante react-native-bluetooth-classic.
 * - Bluetooth Low Energy (GATT / BLE) mediante react-native-ble-plx.
 */
class BluetoothServiceClass {
  private bleManager: BleManager | null = null;
  private dispositivoConectadoClassic: BluetoothDevice | null = null;
  private dispositivoConectadoBle: Device | null = null;
  private onDesconexionCallback: (() => void) | null = null;
  private onDatosRecibidosCallback: ((data: string) => void) | null = null;
  private disconnectSubscription: any = null;
  private classicDisconnectSubscription: any = null;
  private dataSubscription: any = null;
  private bleScanTimeout: NodeJS.Timeout | null = null;

  /**
   * Comprueba de manera segura si el módulo nativo de Bluetooth Clásico está vinculado en la plataforma.
   */
  private esClassicDisponible(): boolean {
    try {
      return !!NativeModules.RNBluetoothClassic;
    } catch {
      return false;
    }
  }

  /**
   * Registra una función de retorno (callback) que se invocará cuando el dispositivo
   * conectado se desconecte de forma inesperada.
   */
  registrarOnDesconexion(callback: () => void) {
    this.onDesconexionCallback = callback;
  }

  /**
   * Registra un callback para recibir telemetría y respuestas estructuradas del locker.
   */
  registrarOnDatosRecibidos(callback: (data: string) => void) {
    this.onDatosRecibidosCallback = callback;
  }

  /**
   * Notifica a los suscriptores la recepción de una nueva línea de telemetría.
   */
  private notificarDatosRecibidos(data: string) {
    const dataLimpia = data.trim();
    if (dataLimpia.length > 0 && this.onDatosRecibidosCallback) {
      this.onDatosRecibidosCallback(dataLimpia);
    }
  }

  /**
   * Configura la escucha activa de eventos de desconexión física para el dispositivo BLE conectado.
   */
  private registrarMonitoreoDesconexion(device: Device) {
    if (this.disconnectSubscription) {
      try {
        this.disconnectSubscription.remove();
      } catch (e) {
        // Ignorar posibles errores al limpiar suscripciones previas
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
   * Configura la escucha activa de desconexión física para el dispositivo Bluetooth Clásico.
   */
  private registrarMonitoreoDesconexionClassic(device: BluetoothDevice, address: string) {
    if (this.classicDisconnectSubscription) {
      try {
        this.classicDisconnectSubscription.remove();
      } catch (e) {
        // Ignorar
      }
      this.classicDisconnectSubscription = null;
    }

    if (device && typeof (device as any).onDisconnected === 'function') {
      try {
        this.classicDisconnectSubscription = (device as any).onDisconnected(() => {
          console.log('[Classic] Dispositivo desconectado físicamente:', address);
          if (this.onDesconexionCallback) {
            this.onDesconexionCallback();
          }
          this.dispositivoConectadoClassic = null;
        });
      } catch (e) {
        console.warn('Error al registrar listener de desconexión en device Classic', e);
      }
    } else if (this.esClassicDisponible() && typeof (RNBluetoothClassic as any).onDeviceDisconnected === 'function') {
      try {
        this.classicDisconnectSubscription = (RNBluetoothClassic as any).onDeviceDisconnected(
          (event: { address?: string }) => {
            if (event && event.address && event.address.toLowerCase() === address.toLowerCase()) {
              console.log('[Classic] Evento nativo de desconexión recibido para:', event.address);
              if (this.onDesconexionCallback) {
                this.onDesconexionCallback();
              }
              this.dispositivoConectadoClassic = null;
            }
          }
        );
      } catch (e) {
        console.warn('Error registrando listener global de desconexión Classic', e);
      }
    }

    // Registrar escucha activa de lectura entrante (telemetría)
    if (this.dataSubscription) {
      try {
        this.dataSubscription.remove();
      } catch (e) {
        // Ignorar
      }
      this.dataSubscription = null;
    }

    if (device && typeof (device as any).onDataReceived === 'function') {
      try {
        this.dataSubscription = (device as any).onDataReceived((event: { data: string }) => {
          if (event && event.data) {
            this.notificarDatosRecibidos(event.data);
          }
        });
      } catch (e) {
        console.warn('Error al registrar listener de datos en device Classic', e);
      }
    } else if (this.esClassicDisponible() && typeof (RNBluetoothClassic as any).onDeviceRead === 'function') {
      try {
        this.dataSubscription = (RNBluetoothClassic as any).onDeviceRead(
          address,
          (event: { data?: string }) => {
            if (event && event.data) {
              this.notificarDatosRecibidos(event.data);
            }
          }
        );
      } catch (e) {
        console.warn('Error al registrar onDeviceRead global', e);
      }
    }
  }

  /**
   * Obtiene o instancia el manejador BleManager de forma perezosa (Lazy Initialization)
   * para evitar sobrecoste en el arranque.
   */
  private getBleManager(): BleManager | null {
    try {
      if (!this.bleManager) {
        this.bleManager = new BleManager();
      }
      return this.bleManager;
    } catch (e) {
      console.warn('[BLE] El módulo react-native-ble-plx no está disponible en este entorno', e);
      return null;
    }
  }

  /**
   * Solicita al usuario los permisos de sistema requeridos en Android (incluyendo Android 12+ API 31+).
   */
  async solicitarPermisos(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      const apiLevel = typeof Platform.Version === 'number'
        ? Platform.Version
        : parseInt(String(Platform.Version), 10);

      if (apiLevel >= 31) {
        // Android 12+ requiere BLUETOOTH_SCAN y BLUETOOTH_CONNECT en tiempo de ejecución
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
        // Versiones anteriores a Android 12 requieren ACCESS_FINE_LOCATION para escanear
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (e) {
      console.warn('Error solicitando permisos Bluetooth en el dispositivo', e);
      return false;
    }
  }

  /**
   * Determina si el hardware del teléfono admite conectividad Bluetooth (Clásico o BLE).
   */
  async esSoportado(): Promise<boolean> {
    if (this.getBleManager() !== null) {
      return true;
    }
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
   * Comprueba si el adaptador Bluetooth del teléfono está actualmente encendido.
   */
  async estaEncendido(): Promise<boolean> {
    if (this.esClassicDisponible()) {
      try {
        const activeClassic = await RNBluetoothClassic.isBluetoothEnabled();
        if (activeClassic) return true;
      } catch (e) {
        // Continuar con verificación BLE
      }
    }

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
   * Solicita al sistema operativo habilitar el adaptador Bluetooth si está apagado.
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
   * Realiza un escaneo exhaustivo unificado descubriendo:
   * 1. Dispositivos clásicos emparejados (Android bonded devices).
   * 2. Nuevos dispositivos clásicos en rango de descubrimiento.
   * 3. Dispositivos BLE anunciándose en las inmediaciones.
   */
  async listarDispositivos(): Promise<DispositivoBT[]> {
    const okPermisos = await this.solicitarPermisos();
    if (!okPermisos) {
      throw new Error('Permisos de Bluetooth no concedidos');
    }

    // Cancelar cualquier escaneo previo para evitar colisiones y fugas de recursos
    await this.cancelarDescubrimiento();

    const mapa = new Map<string, DispositivoBT>();

    // 1. Obtener dispositivos emparejados previamente en el sistema (Classic)
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

    // 2. Ejecutar escaneos de descubrimiento en paralelo
    const promesas: Promise<void>[] = [];

    // Descubrimiento de Bluetooth Clásico (Android)
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

    // Escaneo de Bluetooth Low Energy (iOS y Android)
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

          // Limitar escaneo activo BLE a 4 segundos de forma controlada
          if (this.bleScanTimeout) {
            clearTimeout(this.bleScanTimeout);
          }

          this.bleScanTimeout = setTimeout(() => {
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
            this.bleScanTimeout = null;
            resolve();
          }, 4000);
        })
      );
    }

    await Promise.all(promesas);

    return Array.from(mapa.values());
  }

  /**
   * Establece conexión inalámbrica con el locker especificado con timeout controlado.
   *
   * @param address Dirección MAC física o UUID del dispositivo
   * @param type Tipo de conexión ('classic' o 'ble')
   */
  async conectar(address: string, type: 'classic' | 'ble' = 'classic'): Promise<void> {
    await this.cancelarDescubrimiento();

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Tiempo de espera agotado: El Pocket Locker no responde')),
        4500
      )
    );

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

        const device = await Promise.race([
          RNBluetoothClassic.connectToDevice(address, {
            delimiter: '\n',
          }),
          timeoutPromise,
        ]);
        this.dispositivoConectadoClassic = device;

        // Registrar escucha activa de desconexión física y datos para Classic
        this.registrarMonitoreoDesconexionClassic(device, address);
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

        const device = await Promise.race([
          manager.connectToDevice(address),
          timeoutPromise,
        ]);
        await device.discoverAllServicesAndCharacteristics();
        this.dispositivoConectadoBle = device;

        // Registrar escucha activa de desconexión física para BLE
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
   * Envía un comando o trama de datos segura al microcontrolador conectado.
   *
   * @param comando Cadena de caracteres o trama formateada (ej. 'E', 'H' o 'PLK:7492:E\n')
   * @param type Tipo de conexión activa
   */
  async enviarComando(comando: string, type: 'classic' | 'ble' = 'classic'): Promise<void> {
    // Asegurar que las tramas multicarácter finalicen con salto de línea si es protocolo seguro
    const payload = comando.endsWith('\n') ? comando : `${comando}\n`;

    if (type === 'classic') {
      if (!this.esClassicDisponible()) {
        throw new Error('El módulo nativo de Bluetooth Clásico no está disponible en este dispositivo');
      }
      if (!this.dispositivoConectadoClassic) {
        throw new Error('No hay dispositivo Clásico conectado');
      }
      try {
        await this.dispositivoConectadoClassic.write(payload);
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

        const base64Comando = this.toBase64(payload);
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
   * Envía un comando y espera de forma asíncrona la confirmación o código de error del ESP32.
   *
   * @param comando Comando o trama a transmitir
   * @param type Tipo de enlace Bluetooth ('classic' | 'ble')
   * @param timeoutMs Tiempo máximo de espera para la respuesta (por defecto 3000 ms)
   * @returns Respuesta estructurada recibida del microcontrolador
   */
  async enviarComandoConRespuesta(
    comando: string,
    type: 'classic' | 'ble' = 'classic',
    timeoutMs: number = 3000
  ): Promise<string> {
    return new Promise<string>(async (resolve, reject) => {
      let finalizado = false;
      const callbackOriginal = this.onDatosRecibidosCallback;

      const limpiar = () => {
        finalizado = true;
        clearTimeout(timer);
        this.onDatosRecibidosCallback = callbackOriginal;
      };

      const timer = setTimeout(() => {
        if (!finalizado) {
          limpiar();
          // Fallback tolerante: si se agota el tiempo pero el write fue OK, consideramos enviado
          resolve('OK:TIMEOUT_FALLBACK');
        }
      }, timeoutMs);

      this.onDatosRecibidosCallback = (linea: string) => {
        if (callbackOriginal) callbackOriginal(linea);

        if (finalizado) return;

        if (linea.startsWith('OK:')) {
          limpiar();
          resolve(linea);
        } else if (linea.startsWith('ERR:COOLDOWN:')) {
          limpiar();
          const partes = linea.split(':');
          const ms = parseInt(partes[2] || '2000', 10);
          const seg = (ms / 1000).toFixed(1);
          reject(new Error(`Relé en enfriamiento. Espera ${seg}s para volver a pulsar.`));
        } else if (linea.startsWith('ERR:EN_EJECUCION:')) {
          limpiar();
          reject(new Error('La apertura ya se encuentra en ejecución actualmente.'));
        } else if (linea.startsWith('ERR:AUTH_INVALIDA') || linea.startsWith('ERR:AUTH_FALLIDA')) {
          limpiar();
          reject(new Error('Clave o firma de seguridad incorrecta. Revisa el PIN en Ajustes.'));
        } else if (linea.startsWith('ERR:')) {
          limpiar();
          reject(new Error(`Error del locker: ${linea}`));
        }
      };

      try {
        await this.enviarComando(comando, type);
      } catch (e) {
        limpiar();
        reject(e);
      }
    });
  }

  /**
   * Cierra de forma ordenada y limpia cualquier conexión activa existente.
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

    if (this.classicDisconnectSubscription) {
      try {
        this.classicDisconnectSubscription.remove();
      } catch (e) {
        // Ignorar
      }
      this.classicDisconnectSubscription = null;
    }

    if (this.dataSubscription) {
      try {
        this.dataSubscription.remove();
      } catch (e) {
        // Ignorar
      }
      this.dataSubscription = null;
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
   * Verifica si actualmente existe un enlace de comunicación abierto con el hardware.
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
   * Cancela cualquier proceso de búsqueda o escaneo activo en ambos subsistemas.
   */
  async cancelarDescubrimiento(): Promise<void> {
    if (this.bleScanTimeout) {
      clearTimeout(this.bleScanTimeout);
      this.bleScanTimeout = null;
    }

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
   * Inspecciona los servicios del dispositivo BLE para encontrar la primera característica escribible.
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
      console.warn('Error buscando características de escritura BLE', e);
      return null;
    }
  }

  /**
   * Convierte una cadena de texto a codificación Base64 en puro JavaScript sin dependencias nativas.
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
