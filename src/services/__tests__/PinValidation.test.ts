jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import { parsearYValidarPin } from '../StorageService';

describe('Validador y Parser de PIN (Reglas de Acceso Pocket Locker)', () => {
  it('debería reconocer el PIN 2415 como Administrador con acceso total e indefinido', () => {
    const res = parsearYValidarPin('2415');
    expect(res.esValido).toBe(true);
    expect(res.esAdmin).toBe(true);
    expect(res.peatonal).toBe(true);
    expect(res.garaje).toBe(true);
    expect(res.dias).toBeNull();
  });

  it('debería validar 2S0BP1G1 para ambas puertas de forma indefinida', () => {
    const res = parsearYValidarPin('2S0BP1G1');
    expect(res.esValido).toBe(true);
    expect(res.esAdmin).toBe(false);
    expect(res.peatonal).toBe(true);
    expect(res.garaje).toBe(true);
    expect(res.dias).toBeNull();
  });

  it('debería validar 2S0BP1G0 para acceso solo peatonal indefinido', () => {
    const res = parsearYValidarPin('2S0BP1G0');
    expect(res.esValido).toBe(true);
    expect(res.esAdmin).toBe(false);
    expect(res.peatonal).toBe(true);
    expect(res.garaje).toBe(false);
    expect(res.dias).toBeNull();
  });

  it('debería validar 2S0BP0G1 para acceso solo garaje indefinido', () => {
    const res = parsearYValidarPin('2S0BP0G1');
    expect(res.esValido).toBe(true);
    expect(res.esAdmin).toBe(false);
    expect(res.peatonal).toBe(false);
    expect(res.garaje).toBe(true);
    expect(res.dias).toBeNull();
  });

  it('debería validar 2S0BP1G03 para acceso solo peatonal durante 3 días', () => {
    const res = parsearYValidarPin('2S0BP1G03');
    expect(res.esValido).toBe(true);
    expect(res.esAdmin).toBe(false);
    expect(res.peatonal).toBe(true);
    expect(res.garaje).toBe(false);
    expect(res.dias).toBe(3);
  });

  it('debería validar hasta 2 dígitos de días (ej. 99 días con 2S0BP1G199)', () => {
    const res = parsearYValidarPin('2S0BP1G199');
    expect(res.esValido).toBe(true);
    expect(res.esAdmin).toBe(false);
    expect(res.peatonal).toBe(true);
    expect(res.garaje).toBe(true);
    expect(res.dias).toBe(99);
  });

  it('debería ser insensible a mayúsculas/minúsculas (ej. 2s0bp1g1)', () => {
    const res = parsearYValidarPin('2s0bp1g1');
    expect(res.esValido).toBe(true);
    expect(res.peatonal).toBe(true);
    expect(res.garaje).toBe(true);
  });

  it('debería rechazar 2S0BP0G0 porque no concede ningún acceso', () => {
    const res = parsearYValidarPin('2S0BP0G0');
    expect(res.esValido).toBe(false);
    expect(res.mensajeError).toContain('al menos un acceso');
  });

  it('debería rechazar códigos con formatos incorrectos', () => {
    expect(parsearYValidarPin('1234').esValido).toBe(false);
    expect(parsearYValidarPin('2S0BP2G1').esValido).toBe(false);
    expect(parsearYValidarPin('2S0BP1G').esValido).toBe(false);
    expect(parsearYValidarPin('2S0BP1G1000').esValido).toBe(false); // más de 2 dígitos
    expect(parsearYValidarPin('').esValido).toBe(false);
  });
});
