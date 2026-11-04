jest.mock('react-native', () => ({
  Platform: { OS: 'android', Version: 34 },
  PermissionsAndroid: {
    PERMISSIONS: {
      BLUETOOTH_SCAN: 'scan',
      BLUETOOTH_CONNECT: 'connect',
      BLUETOOTH_ADVERTISE: 'advertise',
      ACCESS_FINE_LOCATION: 'fine',
      ACCESS_COARSE_LOCATION: 'coarse',
    },
    RESULTS: { GRANTED: 'granted' },
    check: jest.fn(),
    requestMultiple: jest.fn(),
  },
  NativeModules: { RNBluetoothClassic: {} },
  Linking: { openSettings: jest.fn().mockResolvedValue(undefined) },
  AppState: { addEventListener: jest.fn() },
}));

jest.mock('react-native-bluetooth-classic', () => ({
  __esModule: true,
  default: {
    isBluetoothAvailable: jest.fn(),
    isBluetoothEnabled: jest.fn(),
    requestBluetoothEnabled: jest.fn(),
    getBondedDevices: jest.fn(),
    cancelDiscovery: jest.fn(),
  },
}));

jest.mock('react-native-ble-plx', () => ({ BleManager: jest.fn() }));

jest.mock('expo-intent-launcher', () => ({
  startActivityAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/StorageService', () => ({
  __esModule: true,
  default: {},
  DEFAULT_SECURITY_PIN: '2415',
  LogService: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), setRemoteForwarder: jest.fn() },
}));

import { Platform, PermissionsAndroid, NativeModules, Linking } from 'react-native';
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import { startActivityAsync } from 'expo-intent-launcher';
import { BluetoothService } from '../../src/services/BluetoothService';

const check = PermissionsAndroid.check as jest.Mock;
const classic = RNBluetoothClassic as unknown as Record<string, jest.Mock>;
const abrirIntent = startActivityAsync as jest.Mock;
const abrirAjustesApp = Linking.openSettings as jest.Mock;

describe('BluetoothService: guardas para no cerrar la app sin Bluetooth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (NativeModules as any).RNBluetoothClassic = {};
    abrirIntent.mockResolvedValue(undefined);
    (Platform as any).Version = 34;
    classic.isBluetoothAvailable.mockResolvedValue(true);
    classic.requestBluetoothEnabled.mockResolvedValue(true);
    classic.cancelDiscovery.mockResolvedValue(true);
    classic.getBondedDevices.mockResolvedValue([{ address: 'AA:BB' }]);
    check.mockResolvedValue(true);
  });

  describe('pedirActivar', () => {
    it('pide activar Bluetooth cuando hay adaptador y permisos', async () => {
      await expect(BluetoothService.pedirActivar()).resolves.toBe(true);
      expect(classic.requestBluetoothEnabled).toHaveBeenCalledTimes(1);
    });

    it('no llama al módulo nativo si faltan permisos', async () => {
      check.mockResolvedValue(false);
      await expect(BluetoothService.pedirActivar()).resolves.toBe(false);
      expect(classic.requestBluetoothEnabled).not.toHaveBeenCalled();
    });

    it('no llama al módulo nativo si el dispositivo no tiene adaptador (emulador)', async () => {
      classic.isBluetoothAvailable.mockResolvedValue(false);
      await expect(BluetoothService.pedirActivar()).resolves.toBe(false);
      expect(classic.requestBluetoothEnabled).not.toHaveBeenCalled();
    });

    it('devuelve false en vez de propagar si el módulo nativo falla', async () => {
      classic.requestBluetoothEnabled.mockRejectedValue(new Error('boom'));
      await expect(BluetoothService.pedirActivar()).resolves.toBe(false);
    });
  });

  describe('sin módulo nativo de Bluetooth (Expo Go / build sin módulos)', () => {
    beforeEach(() => {
      (NativeModules as any).RNBluetoothClassic = undefined;
    });

    it('una llamada automática (abrirAjustes=false) NO saca al usuario a los ajustes', async () => {
      await expect(BluetoothService.pedirActivar(false)).resolves.toBe(false);
      expect(abrirIntent).not.toHaveBeenCalled();
      expect(abrirAjustesApp).not.toHaveBeenCalled();
    });

    it('una llamada del usuario abre los ajustes de Bluetooth, no la info de la app', async () => {
      await expect(BluetoothService.pedirActivar()).resolves.toBe(false);
      expect(abrirIntent).toHaveBeenCalledWith('android.settings.BLUETOOTH_SETTINGS');
      expect(abrirAjustesApp).not.toHaveBeenCalled();
    });

    it('si el intent falla, cae a los ajustes de la app', async () => {
      abrirIntent.mockRejectedValue(new Error('sin módulo'));
      await BluetoothService.abrirAjustesBluetooth();
      expect(abrirAjustesApp).toHaveBeenCalledTimes(1);
    });
  });

  describe('tienePermisos', () => {
    it('en Android 12+ exige BLUETOOTH_SCAN y BLUETOOTH_CONNECT', async () => {
      check.mockImplementation(async (p: string) => p === 'scan');
      await expect(BluetoothService.tienePermisos()).resolves.toBe(false);

      check.mockResolvedValue(true);
      await expect(BluetoothService.tienePermisos()).resolves.toBe(true);
    });

    it('en Android 11 o inferior basta con un permiso de ubicación', async () => {
      (Platform as any).Version = 30;
      check.mockImplementation(async (p: string) => p === 'coarse');
      await expect(BluetoothService.tienePermisos()).resolves.toBe(true);
    });

    it('devuelve false si la comprobación lanza', async () => {
      check.mockRejectedValue(new Error('boom'));
      await expect(BluetoothService.tienePermisos()).resolves.toBe(false);
    });
  });

  describe('llamadas nativas protegidas por permisos', () => {
    it('getBondedDevices devuelve [] y no toca el módulo sin permisos', async () => {
      check.mockResolvedValue(false);
      await expect(BluetoothService.getBondedDevices()).resolves.toEqual([]);
      expect(classic.getBondedDevices).not.toHaveBeenCalled();
    });

    it('cancelarDescubrimiento no toca el módulo sin permisos', async () => {
      check.mockResolvedValue(false);
      await BluetoothService.cancelarDescubrimiento();
      expect(classic.cancelDiscovery).not.toHaveBeenCalled();
    });
  });
});
