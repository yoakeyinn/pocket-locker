jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  readDirectoryAsync: jest.fn(),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

import { BackHandler, NativeModules, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import salirApp from 'react-native-exit-app';
import { cerrarAplicacion, limpiarCache } from '../../src/services/Salir';

const leer = FileSystem.readDirectoryAsync as jest.Mock;
const borrar = FileSystem.deleteAsync as jest.Mock;

describe('Salir', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'android';
    (NativeModules as any).RNExitApp = {};
    leer.mockResolvedValue(['a.tmp', 'b.tmp']);
  });

  it('limpia solo la carpeta de caché, archivo a archivo', async () => {
    await limpiarCache();
    expect(borrar).toHaveBeenCalledTimes(2);
    expect(borrar).toHaveBeenCalledWith('file:///cache/a.tmp', { idempotent: true });
  });

  it('si no se puede limpiar la caché, no lanza', async () => {
    leer.mockRejectedValue(new Error('disco'));
    await expect(limpiarCache()).resolves.toBeUndefined();
  });

  it('en Android limpia la caché y cierra el proceso del todo', async () => {
    await cerrarAplicacion();
    expect(borrar).toHaveBeenCalled();
    expect(salirApp.exitApp).toHaveBeenCalledTimes(1);
  });

  it('aunque falle la limpieza, la app se cierra igualmente', async () => {
    leer.mockRejectedValue(new Error('disco'));
    await cerrarAplicacion();
    expect(salirApp.exitApp).toHaveBeenCalledTimes(1);
  });

  it('si el módulo nativo falla al ejecutarse, recurre a BackHandler', async () => {
    (salirApp.exitApp as jest.Mock).mockImplementationOnce(() => {
      throw new Error('fallo nativo');
    });
    const respaldo = jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => true);
    await cerrarAplicacion();
    expect(respaldo).toHaveBeenCalled();
    respaldo.mockRestore();
  });

  it('SIN el módulo nativo (Expo Go) ni siquiera lo carga —cargarlo daría un error fatal— y usa BackHandler', async () => {
    delete (NativeModules as any).RNExitApp;
    const respaldo = jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => true);
    await cerrarAplicacion();
    expect(salirApp.exitApp).not.toHaveBeenCalled();
    expect(respaldo).toHaveBeenCalled();
    respaldo.mockRestore();
  });

  it('en iOS no hace nada (el sistema no permite cerrar una app por código)', async () => {
    (Platform as any).OS = 'ios';
    await cerrarAplicacion();
    expect(salirApp.exitApp).not.toHaveBeenCalled();
    expect(borrar).not.toHaveBeenCalled();
  });
});
