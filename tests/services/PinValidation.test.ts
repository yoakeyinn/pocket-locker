jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import { esPinValido, DEFAULT_SECURITY_PIN } from '../../src/services/StorageService';

describe('Validación del PIN (Pocket Locker)', () => {
  it('acepta únicamente el PIN 2415, que es DEFAULT_SECURITY_PIN', () => {
    expect(DEFAULT_SECURITY_PIN).toBe('2415');
    expect(esPinValido('2415')).toBe(true);
    expect(esPinValido(DEFAULT_SECURITY_PIN)).toBe(true);
  });

  it('ignora los espacios alrededor del PIN', () => {
    expect(esPinValido('  2415  ')).toBe(true);
  });

  it('rechaza PINs no autorizados como 2413, 1234 o hashes antiguos', () => {
    expect(esPinValido('2413')).toBe(false);
    expect(esPinValido('1234')).toBe(false);
    expect(esPinValido('2S0BP1G1')).toBe(false);
  });

  it('rechaza cadenas vacías o valores nulos', () => {
    expect(esPinValido('')).toBe(false);
    expect(esPinValido(null)).toBe(false);
    expect(esPinValido(undefined)).toBe(false);
  });
});

describe('LogService (Reenvío de errores y advertencias al ESP32)', () => {
  it('debería reenviar logs de nivel warn y error al forwarder configurado', () => {
    const { LogService } = require('../../src/services/StorageService');
    const mockForwarder = jest.fn();
    LogService.setRemoteForwarder(mockForwarder);

    LogService.warn('Aviso de prueba');
    expect(mockForwarder).toHaveBeenCalledWith('WARN', expect.stringContaining('Aviso de prueba'));

    LogService.error('Error de prueba');
    expect(mockForwarder).toHaveBeenCalledWith('ERROR', expect.stringContaining('Error de prueba'));

    LogService.setRemoteForwarder(null);
  });
});
