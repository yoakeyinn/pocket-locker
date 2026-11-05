import { mostrarModal } from '../components/Modal';
import { t } from '../styles/i18n';
import BluetoothService from './BluetoothService';

export async function pedirPermisosBluetooth(): Promise<boolean> {
  if (await BluetoothService.tienePermisos()) return true;
  return new Promise<boolean>((resolver) =>
    mostrarModal(t('pl_permisos_titulo'), t('pl_permisos_mensaje', { app: t('pl_app_titulo') }), [
      { text: t('pl_cancelar'), style: 'cancel', onPress: () => resolver(false) },
      { text: t('pl_conceder_permisos'), onPress: () => resolver(BluetoothService.solicitarPermisos()) },
    ])
  );
}
