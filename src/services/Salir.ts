import { BackHandler, NativeModules, Platform, TurboModuleRegistry } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { LogService } from './StorageService';

export async function limpiarCache(): Promise<void> {
  try {
    const carpeta = FileSystem.cacheDirectory;
    if (!carpeta) return;
    for (const nombre of await FileSystem.readDirectoryAsync(carpeta)) {
      await FileSystem.deleteAsync(carpeta + nombre, { idempotent: true });
    }
  } catch (e) {
    LogService.warn('[Salir] No se pudo limpiar la caché', e);
  }
}

const moduloDeCierreDisponible = (): boolean => !!(NativeModules.RNExitApp ?? TurboModuleRegistry.get('RNExitApp'));

export async function cerrarAplicacion(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await limpiarCache();
  if (moduloDeCierreDisponible()) {
    try {
      require('react-native-exit-app').default.exitApp();
      return;
    } catch (e) {
      LogService.warn('[Salir] El módulo nativo de cierre falló: se usa BackHandler', e);
    }
  }
  BackHandler.exitApp();
}
