import BluetoothService, { usePocketStore } from './BluetoothService';
import { limpiarCache } from './Salir';
import { sincronizarSimulacion } from './Simulacion';
import { LogService, StorageService } from './StorageService';
import { marcarDesbloqueada, setAccesibilidad, setBiometria } from './preferencias';
import { setIdioma } from '../styles/i18n';
import { setTema } from '../styles/styles';

export async function borrarDatosApp(): Promise<void> {
  LogService.info('[Reinicio] Borrando todos los datos de la aplicación');
  const { deviceMac } = usePocketStore.getState();

  await BluetoothService.desconectar().catch((e) => LogService.warn('[Reinicio] No se pudo desconectar', e));
  if (deviceMac) {
    await BluetoothService.desvincularDispositivo(deviceMac).catch((e) =>
      LogService.warn('[Reinicio] No se pudo desemparejar del sistema', e)
    );
  }
  await sincronizarSimulacion(null);

  await StorageService.borrarTodo();
  await limpiarCache();

  setIdioma('es');
  setTema('oscuro');
  setBiometria(false);
  setAccesibilidad(false);
  marcarDesbloqueada(false);
  usePocketStore.getState().resetStore();
  await usePocketStore.getState().inicializar();
}
