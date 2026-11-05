jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('react-native-bluetooth-classic', () => ({ __esModule: true, default: {} }));
jest.mock('react-native-ble-plx', () => ({ BleManager: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///docs/',
  EncodingType: { UTF8: 'utf8' },
  readDirectoryAsync: jest.fn().mockResolvedValue(['x.tmp']),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import BluetoothService, { usePocketStore } from '../../src/services/BluetoothService';
import { borrarDatosApp } from '../../src/services/Reinicio';
import { activarSimulacion, estaSimulando } from '../../src/services/Simulacion';
import { StorageService } from '../../src/services/StorageService';
import { usePreferencias } from '../../src/services/preferencias';
import { setIdioma, t } from '../../src/styles/i18n';
import { Colors, setTema } from '../../src/styles/styles';

describe('borrarDatosApp (vuelve a empezar)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    await StorageService.saveUserName('Ana');
    await StorageService.saveDevice('AA:BB:CC:DD:EE:FF', 'Mi locker', 'classic', '2415', 'Ana');
    await StorageService.saveIdioma('en');
    await StorageService.saveTema('oscuro');
    await StorageService.saveBiometria(true);
    setIdioma('en');
    setTema('oscuro');
    usePreferencias.setState({ biometria: true, desbloqueada: true, cargadas: true });
    usePocketStore.setState({ deviceMac: 'AA:BB:CC:DD:EE:FF', deviceName: 'Mi locker', userName: 'Ana', status: 'disconnected' });
    jest.spyOn(BluetoothService, 'desconectar').mockResolvedValue(undefined as any);
    jest.spyOn(BluetoothService, 'desvincularDispositivo').mockResolvedValue(true);
  });
  afterEach(() => jest.restoreAllMocks());

  it('borra todo lo guardado: no queda ninguna clave', async () => {
    await borrarDatosApp();
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
  });

  it('desconecta y desempareja el locker del sistema', async () => {
    await borrarDatosApp();
    expect(BluetoothService.desconectar).toHaveBeenCalled();
    expect(BluetoothService.desvincularDispositivo).toHaveBeenCalledWith('AA:BB:CC:DD:EE:FF');
  });

  it('vacía la caché de archivos', async () => {
    await borrarDatosApp();
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///cache/x.tmp', { idempotent: true });
  });

  it('vuelve a los valores de por defecto en memoria: sin nombre ni dispositivo, español, tema oscuro y sin bloqueo', async () => {
    await borrarDatosApp();
    const tienda = usePocketStore.getState();
    expect(tienda.userName).toBeNull();
    expect(tienda.deviceMac).toBeNull();
    expect(tienda.status).toBe('unpaired');
    expect(tienda.cargando).toBe(false);
    expect(t('pl_idioma')).toBe('Idioma');
    expect(Colors.beige).toBe('#0F0F0F');
    expect(usePreferencias.getState()).toMatchObject({ biometria: false, desbloqueada: false });
  });

  it('también sale del modo demo', async () => {
    activarSimulacion();
    expect(estaSimulando()).toBe(true);
    await borrarDatosApp();
    expect(estaSimulando()).toBe(false);
  });

  it('si no había dispositivo vinculado no intenta desemparejar nada', async () => {
    usePocketStore.setState({ deviceMac: null });
    await borrarDatosApp();
    expect(BluetoothService.desvincularDispositivo).not.toHaveBeenCalled();
  });

  it('aunque falle desconectar o desemparejar, el borrado continúa', async () => {
    (BluetoothService.desconectar as jest.Mock).mockRejectedValue(new Error('x'));
    (BluetoothService.desvincularDispositivo as jest.Mock).mockRejectedValue(new Error('y'));
    await borrarDatosApp();
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });
});
