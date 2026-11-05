import * as LocalAuthentication from 'expo-local-authentication';
import { t } from '../styles/i18n';
import { LogService } from './StorageService';

export type MetodoBloqueo = 'biometria' | 'credencial' | 'ninguno';

const NIVEL_CREDENCIAL = 1;
const NIVEL_BIOMETRIA = 2;

export const Biometria = {
  async metodo(): Promise<MetodoBloqueo> {
    try {
      const nivel = await LocalAuthentication.getEnrolledLevelAsync();
      if (nivel >= NIVEL_BIOMETRIA) return 'biometria';
      if (nivel === NIVEL_CREDENCIAL) return 'credencial';
      return 'ninguno';
    } catch (e) {
      LogService.warn('[Biometria] No se pudo comprobar la seguridad del teléfono', e);
      return 'ninguno';
    }
  },

  async autenticar(): Promise<boolean> {
    try {
      const resultado = await LocalAuthentication.authenticateAsync({
        promptMessage: t('pl_biometria_motivo'),
        cancelLabel: t('pl_cancelar'),
        disableDeviceFallback: false,
      });
      LogService.info(`[Biometria] Autenticación: ${resultado.success ? 'correcta' : `rechazada (${resultado.error})`}`);
      return resultado.success;
    } catch (e) {
      LogService.error('[Biometria] La autenticación falló', e);
      return false;
    }
  },
};
