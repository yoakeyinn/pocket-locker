jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import { DEFAULT_SECURITY_PIN, esPinValido, parsearPin } from '../../src/services/comun';

describe('Códigos de acceso (PIN de administrador y 2S0BP)', () => {
  it('el PIN 2415 es el administrador: abre ambas puertas sin caducidad', () => {
    expect(DEFAULT_SECURITY_PIN).toBe('2415');
    expect(parsearPin('2415')).toEqual({ esValido: true, peatonal: true, garaje: true, dias: null });
    expect(parsearPin('  2415  ').esValido).toBe(true);
  });

  it('2S0BP<p>G<g> autoriza solo las puertas marcadas con 1', () => {
    expect(parsearPin('2S0BP1G1')).toEqual({ esValido: true, peatonal: true, garaje: true, dias: null });
    expect(parsearPin('2S0BP1G0')).toMatchObject({ esValido: true, peatonal: true, garaje: false });
    expect(parsearPin('2S0BP0G1')).toMatchObject({ esValido: true, peatonal: false, garaje: true });
  });

  it('los dos dígitos finales son los días de acceso (1-99) y se ignoran mayúsculas y espacios', () => {
    expect(parsearPin('2S0BP1G03').dias).toBe(3);
    expect(parsearPin(' 2s0bp0g199 ')).toMatchObject({ esValido: true, garaje: true, dias: 99 });
    expect(parsearPin('2S0BP1G1').dias).toBeNull();
  });

  it('rechaza un código que no autoriza ninguna puerta', () => {
    expect(parsearPin('2S0BP0G0').esValido).toBe(false);
  });

  it('rechaza códigos mal formados, PINs ajenos y valores vacíos', () => {
    for (const pin of ['2413', '1234', '2S0BP2G1', '2S0BP1G', '2S0BP1G1234', 'x2S0BP1G1', '', null, undefined]) {
      expect(esPinValido(pin as string)).toBe(false);
    }
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
