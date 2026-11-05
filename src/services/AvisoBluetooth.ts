import { mostrarModal } from '../components/Modal';
import { t } from '../styles/i18n';
import BluetoothService from './BluetoothService';
import { pedirPermisosBluetooth } from './Permisos';
import { LogService } from './StorageService';

export async function bluetoothApagado(): Promise<boolean> {
  try {
    return (await BluetoothService.esSoportado()) && !(await BluetoothService.estaEncendido());
  } catch (e) {
    LogService.warn('[Arranque] No se pudo comprobar el Bluetooth', e);
    return false;
  }
}

async function encenderBluetooth(): Promise<void> {
  try {
    if (await pedirPermisosBluetooth()) await BluetoothService.pedirActivar();
  } catch (e) {
    LogService.error('[Arranque] No se pudo encender el Bluetooth', e);
  }
}

export function avisarBluetoothApagado(): void {
  mostrarModal(t('pl_bt_apagado_titulo'), t('pl_bt_apagado_inicio_mensaje', { app: t('pl_app_titulo') }), [
    { text: t('pl_ir_ajustes'), onPress: () => BluetoothService.abrirAjustesBluetooth() },
    { text: t('pl_encender'), onPress: encenderBluetooth },
  ]);
}
