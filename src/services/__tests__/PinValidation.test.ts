jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import { parsearYValidarPin, DEFAULT_SECURITY_PIN } from '../StorageService';

describe('Validador y Parser de PIN (Reglas de Acceso Pocket Locker - Versión Estable)', () => {
  it('debería validar exclusivamente el PIN 2415 con acceso universal a ambas puertas sin rol admin', () => {
    const res = parsearYValidarPin('2415');
    expect(res.esValido).toBe(true);
    expect(res.esAdmin).toBe(false);
    expect(res.peatonal).toBe(true);
    expect(res.garaje).toBe(true);
    expect(res.dias).toBeNull();
  });

  it('debería validar DEFAULT_SECURITY_PIN como 2415', () => {
    expect(DEFAULT_SECURITY_PIN).toBe('2415');
    const res = parsearYValidarPin(DEFAULT_SECURITY_PIN);
    expect(res.esValido).toBe(true);
  });

  it('debería manejar espacios alrededor del PIN 2415', () => {
    const res = parsearYValidarPin('  2415  ');
    expect(res.esValido).toBe(true);
    expect(res.peatonal).toBe(true);
    expect(res.garaje).toBe(true);
  });

  it('debería rechazar PINs no autorizados como 2413, 1234 o hashes antiguos', () => {
    const res2413 = parsearYValidarPin('2413');
    expect(res2413.esValido).toBe(false);
    expect(res2413.mensajeError).toContain('2415');

    const res1234 = parsearYValidarPin('1234');
    expect(res1234.esValido).toBe(false);
    expect(res1234.mensajeError).toContain('2415');

    const resHash = parsearYValidarPin('2S0BP1G1');
    expect(resHash.esValido).toBe(false);
    expect(resHash.mensajeError).toContain('2415');
  });

  it('debería rechazar cadenas vacías o valores nulos', () => {
    expect(parsearYValidarPin('').esValido).toBe(false);
    expect(parsearYValidarPin(null as any).esValido).toBe(false);
    expect(parsearYValidarPin(undefined as any).esValido).toBe(false);
  });
});

describe('LogService (Reenvío de errores y advertencias al ESP32)', () => {
  it('debería reenviar logs de nivel warn y error al forwarder configurado', () => {
    const { LogService } = require('../StorageService');
    const mockForwarder = jest.fn();
    LogService.setRemoteForwarder(mockForwarder);

    LogService.warn('Aviso de prueba');
    expect(mockForwarder).toHaveBeenCalledWith('WARN', expect.stringContaining('Aviso de prueba'));

    LogService.error('Error de prueba');
    expect(mockForwarder).toHaveBeenCalledWith('ERROR', expect.stringContaining('Error de prueba'));

    LogService.setRemoteForwarder(null);
  });
});
