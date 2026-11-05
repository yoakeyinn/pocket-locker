jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native-bluetooth-classic', () => ({ __esModule: true, default: {} }));
jest.mock('react-native-ble-plx', () => ({ BleManager: jest.fn() }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { cargarPreferencias, usePreferencias } from '../../src/services/preferencias';
import { StorageService } from '../../src/services/StorageService';
import { desactivarSimulacion, estaSimulando } from '../../src/services/Simulacion';
import { setIdioma, t } from '../../src/styles/i18n';
import { Colors, setTema } from '../../src/styles/styles';

describe('preferencias', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    setTema('claro');
    setIdioma('es');
    usePreferencias.setState({ biometria: false, desbloqueada: false, cargadas: false });
  });

  it('sin nada guardado quedan las de por defecto y se marcan como cargadas', async () => {
    await cargarPreferencias();
    expect(usePreferencias.getState()).toMatchObject({ biometria: false, cargadas: true });
    expect(Colors.beige).toBe('#0F0F0F');
  });

  it('restaura idioma, tema y huella guardados', async () => {
    await StorageService.saveIdioma('en');
    await StorageService.saveTema('oscuro');
    await StorageService.saveBiometria(true);

    await cargarPreferencias();

    expect(t('pl_idioma')).toBe('Language');
    expect(Colors.beige).toBe('#0F0F0F');
    expect(usePreferencias.getState().biometria).toBe(true);
  });

  it('si el nombre guardado es «demo» arranca ya en modo demo; con otro nombre, no', async () => {
    await StorageService.saveUserName('demo');
    await cargarPreferencias();
    expect(estaSimulando()).toBe(true);

    await StorageService.saveUserName('Ana');
    await cargarPreferencias();
    expect(estaSimulando()).toBe(false);
    await desactivarSimulacion();
  });

  it('un valor guardado desconocido se ignora', async () => {
    await AsyncStorage.setItem('tema', 'sepia');
    await cargarPreferencias();
    expect(Colors.beige).toBe('#0F0F0F');
  });

  it('si el almacenamiento falla, igualmente se marcan como cargadas (el splash no se queda esperando)', async () => {
    jest.spyOn(StorageService, 'getTema').mockRejectedValue(new Error('disco'));
    await cargarPreferencias();
    expect(usePreferencias.getState().cargadas).toBe(true);
    jest.restoreAllMocks();
  });
});
