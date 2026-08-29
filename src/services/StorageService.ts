import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import LogService from './LogService';

/**
 * Claves utilizadas para la persistencia local en AsyncStorage y SecureStore.
 */
const KEYS = {
  DEVICE_MAC: 'deviceMac',
  DEVICE_NAME: 'deviceName',
  DEVICE_TYPE: 'deviceType',
  DEVICE_PIN: 'devicePin_secure',
};

/**
 * PIN de seguridad por defecto para la comunicación con el firmware ESP32 Pocket Locker.
 */
export const DEFAULT_SECURITY_PIN = '7492';

/**
 * Estructura de datos completa de un dispositivo Pocket Locker persistido.
 */
export interface DispositivoGuardado {
  mac: string | null;
  name: string | null;
  type: 'classic' | 'ble';
  pin: string;
}

/**
 * Servicio encargado de gestionar la persistencia local de configuración,
 * credenciales y datos del dispositivo Pocket Locker emparejado.
 *
 * Utiliza almacenamiento seguro mediante Hardware Keystore (Android Keystore / iOS Keychain)
 * para los secretos y credenciales (PIN), y AsyncStorage para metadatos públicos (MAC, nombre).
 */
class StorageServiceClass {
  /**
   * Obtiene la dirección MAC o UUID del dispositivo guardado.
   */
  async getDeviceMac(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(KEYS.DEVICE_MAC);
    } catch (e) {
      LogService.error('Error leyendo deviceMac desde storage', e);
      return null;
    }
  }

  /**
   * Obtiene el nombre personalizado asignado al dispositivo.
   */
  async getDeviceName(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(KEYS.DEVICE_NAME);
    } catch (e) {
      LogService.error('Error leyendo deviceName desde storage', e);
      return null;
    }
  }

  /**
   * Obtiene el tipo de conexión Bluetooth configurada ('classic' o 'ble').
   */
  async getDeviceType(): Promise<'classic' | 'ble'> {
    try {
      const type = await AsyncStorage.getItem(KEYS.DEVICE_TYPE);
      return (type === 'ble' ? 'ble' : 'classic') as 'classic' | 'ble';
    } catch (e) {
      LogService.error('Error leyendo deviceType desde storage', e);
      return 'classic';
    }
  }

  /**
   * Obtiene el PIN o clave de seguridad guardada en el enclave seguro (SecureStore).
   */
  async getDevicePin(): Promise<string> {
    try {
      // Intentar leer desde SecureStore (Hardware Keystore)
      const securePin = await SecureStore.getItemAsync(KEYS.DEVICE_PIN);
      if (securePin && securePin.trim().length > 0) {
        return securePin.trim();
      }

      // Fallback a AsyncStorage para migración o entornos sin hardware seguro
      const fallbackPin = await AsyncStorage.getItem(KEYS.DEVICE_PIN);
      if (fallbackPin && fallbackPin.trim().length > 0) {
        return fallbackPin.trim();
      }

      return DEFAULT_SECURITY_PIN;
    } catch (e) {
      LogService.warn('SecureStore no disponible, usando fallback AsyncStorage para PIN', e);
      try {
        const pin = await AsyncStorage.getItem(KEYS.DEVICE_PIN);
        return pin && pin.trim().length > 0 ? pin.trim() : DEFAULT_SECURITY_PIN;
      } catch {
        return DEFAULT_SECURITY_PIN;
      }
    }
  }

  /**
   * Guarda o actualiza el PIN de seguridad en el enclave seguro (SecureStore).
   */
  async saveDevicePin(pin: string): Promise<void> {
    const pinLimpio = pin.trim() || DEFAULT_SECURITY_PIN;
    try {
      await SecureStore.setItemAsync(KEYS.DEVICE_PIN, pinLimpio, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      // Mantener copia sincronizada
      await AsyncStorage.setItem(KEYS.DEVICE_PIN, pinLimpio);
      LogService.info('PIN de seguridad guardado en SecureStore (Hardware Keystore)');
    } catch (e) {
      LogService.warn('SecureStore falló, guardando en AsyncStorage como fallback', e);
      await AsyncStorage.setItem(KEYS.DEVICE_PIN, pinLimpio);
    }
  }

  /**
   * Guarda los datos principales de vinculación de un dispositivo.
   */
  async saveDevice(
    mac: string,
    name: string,
    type: 'classic' | 'ble' = 'classic',
    pin: string = DEFAULT_SECURITY_PIN
  ): Promise<void> {
    try {
      await AsyncStorage.multiSet([
        [KEYS.DEVICE_MAC, mac],
        [KEYS.DEVICE_NAME, name],
        [KEYS.DEVICE_TYPE, type],
      ]);
      await this.saveDevicePin(pin);
      LogService.info(`Dispositivo guardado en storage: ${name} (${mac}) tipo: ${type}`);
    } catch (e) {
      LogService.error('Error guardando dispositivo en storage', e);
      throw e;
    }
  }

  /**
   * Elimina completamente la configuración del dispositivo y el PIN seguro.
   */
  async clearDevice(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        KEYS.DEVICE_MAC,
        KEYS.DEVICE_NAME,
        KEYS.DEVICE_TYPE,
        KEYS.DEVICE_PIN,
      ]);
      try {
        await SecureStore.deleteItemAsync(KEYS.DEVICE_PIN);
      } catch {
        // Ignorar si SecureStore ya estaba vacío
      }
      LogService.info('Dispositivo y credenciales eliminados de storage seguro');
    } catch (e) {
      LogService.error('Error eliminando dispositivo de storage', e);
      throw e;
    }
  }

  /**
   * Lee en una sola operación los metadatos y el PIN de seguridad.
   */
  async obtenerDispositivo(): Promise<DispositivoGuardado> {
    try {
      const resultados = await AsyncStorage.multiGet([
        KEYS.DEVICE_MAC,
        KEYS.DEVICE_NAME,
        KEYS.DEVICE_TYPE,
      ]);
      const mapa = Object.fromEntries(resultados);
      const pin = await this.getDevicePin();

      return {
        mac: mapa[KEYS.DEVICE_MAC] || null,
        name: mapa[KEYS.DEVICE_NAME] || null,
        type: (mapa[KEYS.DEVICE_TYPE] === 'ble' ? 'ble' : 'classic') as 'classic' | 'ble',
        pin: pin || DEFAULT_SECURITY_PIN,
      };
    } catch (e) {
      LogService.error('Error leyendo dispositivo desde storage', e);
      return { mac: null, name: null, type: 'classic', pin: DEFAULT_SECURITY_PIN };
    }
  }
}

const StorageService = new StorageServiceClass();
export default StorageService;
