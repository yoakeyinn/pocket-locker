import AsyncStorage from '@react-native-async-storage/async-storage';
import LogService from './LogService';

const KEYS = {
  DEVICE_MAC: 'deviceMac',
  DEVICE_NAME: 'deviceName',
  DEVICE_TYPE: 'deviceType',
};

class StorageServiceClass {
  async getDeviceMac(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(KEYS.DEVICE_MAC);
    } catch (e) {
      LogService.error('Error leyendo deviceMac desde storage', e);
      return null;
    }
  }

  async getDeviceName(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(KEYS.DEVICE_NAME);
    } catch (e) {
      LogService.error('Error leyendo deviceName desde storage', e);
      return null;
    }
  }

  async getDeviceType(): Promise<'classic' | 'ble'> {
    try {
      const type = await AsyncStorage.getItem(KEYS.DEVICE_TYPE);
      return (type === 'ble' ? 'ble' : 'classic') as 'classic' | 'ble';
    } catch (e) {
      LogService.error('Error leyendo deviceType desde storage', e);
      return 'classic';
    }
  }

  async saveDevice(mac: string, name: string, type: 'classic' | 'ble' = 'classic'): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.DEVICE_MAC, mac);
      await AsyncStorage.setItem(KEYS.DEVICE_NAME, name);
      await AsyncStorage.setItem(KEYS.DEVICE_TYPE, type);
      LogService.info(`Dispositivo guardado en storage: ${name} (${mac}) tipo: ${type}`);
    } catch (e) {
      LogService.error('Error guardando dispositivo en storage', e);
      throw e;
    }
  }

  async clearDevice(): Promise<void> {
    try {
      await AsyncStorage.removeItem(KEYS.DEVICE_MAC);
      await AsyncStorage.removeItem(KEYS.DEVICE_NAME);
      await AsyncStorage.removeItem(KEYS.DEVICE_TYPE);
      LogService.info('Dispositivo eliminado de storage');
    } catch (e) {
      LogService.error('Error eliminando dispositivo de storage', e);
      throw e;
    }
  }

  async obtenerDispositivo(): Promise<{ mac: string | null; name: string | null; type: 'classic' | 'ble' }> {
    try {
      const resultados = await AsyncStorage.multiGet([KEYS.DEVICE_MAC, KEYS.DEVICE_NAME, KEYS.DEVICE_TYPE]);
      const mapa = Object.fromEntries(resultados);
      return {
        mac: mapa[KEYS.DEVICE_MAC] || null,
        name: mapa[KEYS.DEVICE_NAME] || null,
        type: (mapa[KEYS.DEVICE_TYPE] === 'ble' ? 'ble' : 'classic') as 'classic' | 'ble',
      };
    } catch (e) {
      LogService.error('Error leyendo dispositivo en lote desde storage', e);
      return { mac: null, name: null, type: 'classic' };
    }
  }
}

const StorageService = new StorageServiceClass();
export default StorageService;
