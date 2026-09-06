import LogService from './LogService';

let cachedLocalAuth: typeof import('expo-local-authentication') | null | undefined;

/**
 * Obtiene de forma segura el módulo nativo de biometría.
 * Si la app se ejecuta desde una actualización OTA en un APK previo sin la librería nativa compilada,
 * previene cierres inesperados por módulo nativo no encontrado.
 */
function getLocalAuth(): typeof import('expo-local-authentication') | null {
  if (cachedLocalAuth !== undefined) {
    return cachedLocalAuth;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cachedLocalAuth = require('expo-local-authentication');
  } catch {
    cachedLocalAuth = null;
  }
  return cachedLocalAuth ?? null;
}

export interface ResultadoAutenticacionBiometrica {
  exito: boolean;
  cancelado?: boolean;
  mensajeError?: string;
  requiereBuild?: boolean;
}

/**
 * Servicio modular de Autenticación Biométrica (Huella Dactilar / Patrón Biométrico).
 * Proporciona validación de hardware, verificación de registros y prompt interactivo nativo
 * para proteger acciones sensibles (como consultar o editar el PIN de seguridad).
 */
class BiometricService {
  /**
   * Comprueba si el hardware del dispositivo dispone de lector biométrico (huella, rostro).
   */
  async soportaBiometria(): Promise<boolean> {
    const auth = getLocalAuth();
    if (!auth) return false;
    try {
      return await auth.hasHardwareAsync();
    } catch (e: any) {
      LogService.error('Error comprobando soporte biométrico', e);
      return false;
    }
  }

  /**
   * Comprueba si el usuario tiene huellas o biometría configurada en el sistema operativo.
   */
  async tieneBiometriaRegistrada(): Promise<boolean> {
    const auth = getLocalAuth();
    if (!auth) return false;
    try {
      return await auth.isEnrolledAsync();
    } catch (e: any) {
      LogService.error('Error comprobando biometría registrada', e);
      return false;
    }
  }

  /**
   * Solicita autenticación mediante huella dactilar o patrón biométrico del sistema.
   * Si la huella no coincide o es cancelada, deniega el acceso.
   */
  async autenticarParaEditarPin(): Promise<ResultadoAutenticacionBiometrica> {
    try {
      const auth = getLocalAuth();
      if (!auth) {
        return {
          exito: false,
          requiereBuild: true,
          mensajeError:
            'La autenticación por huella requiere generar una nueva versión compilada (EAS Build).',
        };
      }

      const soporta = await this.soportaBiometria();
      if (!soporta) {
        return {
          exito: false,
          mensajeError: 'Tu dispositivo no cuenta con sensor biométrico activo.',
        };
      }

      const registrada = await this.tieneBiometriaRegistrada();
      if (!registrada) {
        return {
          exito: false,
          mensajeError:
            'No tienes ninguna huella dactilar configurada en tu teléfono. Configura tu huella en los Ajustes del móvil para continuar.',
        };
      }

      const res = await auth.authenticateAsync({
        promptMessage: 'Identificación requerida',
        promptSubtitle: 'Verifica tu huella dactilar para ver y modificar el PIN',
        cancelLabel: 'Cancelar',
        fallbackLabel: 'Usar código del teléfono',
        disableDeviceFallback: false,
      });

      if (res.success) {
        return { exito: true };
      }

      if (res.error === 'user_cancel' || res.error === 'app_cancel' || res.error === 'system_cancel') {
        return { exito: false, cancelado: true, mensajeError: 'Autenticación cancelada' };
      }

      return {
        exito: false,
        mensajeError: res.warning || 'No se pudo verificar tu huella dactilar.',
      };
    } catch (e: any) {
      LogService.error('Error durante autenticación biométrica', e);
      return {
        exito: false,
        mensajeError: e?.message || 'Error inesperado al solicitar autenticación biométrica.',
      };
    }
  }
}

export default new BiometricService();
