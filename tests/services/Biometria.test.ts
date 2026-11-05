jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));

import * as LocalAuthentication from 'expo-local-authentication';
import { Biometria } from '../../src/services/Biometria';

const nivel = LocalAuthentication.getEnrolledLevelAsync as jest.Mock;
const autenticar = LocalAuthentication.authenticateAsync as jest.Mock;

describe('Biometria (usa el sistema de seguridad del teléfono)', () => {
  beforeEach(() => {
    nivel.mockResolvedValue(3);
    autenticar.mockResolvedValue({ success: true });
  });

  it('con huella (o cara) registrada el método es la biometría', async () => {
    nivel.mockResolvedValue(3);
    expect(await Biometria.metodo()).toBe('biometria');
    nivel.mockResolvedValue(2);
    expect(await Biometria.metodo()).toBe('biometria');
  });

  it('sin biometría pero con PIN, patrón o contraseña el método es la credencial del teléfono', async () => {
    nivel.mockResolvedValue(1);
    expect(await Biometria.metodo()).toBe('credencial');
  });

  it('sin ninguna seguridad en el teléfono no hay método', async () => {
    nivel.mockResolvedValue(0);
    expect(await Biometria.metodo()).toBe('ninguno');
  });

  it('si el módulo falla se considera que no hay método, sin lanzar', async () => {
    nivel.mockRejectedValue(new Error('nativo'));
    expect(await Biometria.metodo()).toBe('ninguno');
  });

  it('el diálogo solo dice «Verifica tu identidad» y siempre deja el PIN/patrón del teléfono como alternativa', async () => {
    expect(await Biometria.autenticar()).toBe(true);
    const opciones = autenticar.mock.calls[0][0];
    expect(opciones.promptMessage).toBe('Verifica tu identidad');
    expect(opciones.disableDeviceFallback).toBe(false);
    expect(opciones.promptDescription).toBeUndefined();
    expect(opciones.promptSubtitle).toBeUndefined();

    autenticar.mockResolvedValue({ success: false, error: 'user_cancel' });
    expect(await Biometria.autenticar()).toBe(false);
  });

  it('un fallo del módulo al autenticar es un rechazo, no una excepción', async () => {
    autenticar.mockRejectedValue(new Error('nativo'));
    expect(await Biometria.autenticar()).toBe(false);
  });
});
