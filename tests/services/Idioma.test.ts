jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageService } from '../../src/services/StorageService';
import { esIdioma } from '../../src/styles/i18n';

describe('idioma elegido', () => {
  beforeEach(() => AsyncStorage.clear());

  it('sin nada guardado no hay idioma (se usa el de por defecto, español)', async () => {
    expect(await StorageService.getIdioma()).toBeNull();
  });

  it('se guarda y se recupera', async () => {
    await StorageService.saveIdioma('en');
    expect(await StorageService.getIdioma()).toBe('en');
  });

  it('un valor guardado que no es un idioma conocido se ignora', async () => {
    await AsyncStorage.setItem('idioma', 'fr');
    expect(await StorageService.getIdioma()).toBeNull();
    expect(esIdioma('fr')).toBe(false);
    expect(esIdioma('es')).toBe(true);
  });
});
