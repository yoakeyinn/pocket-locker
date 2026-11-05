import { create } from 'zustand';
import { ClaveLiteral, esIdioma, setIdioma } from '../styles/i18n';
import { setTema } from '../styles/styles';
import { sincronizarSimulacion } from './Simulacion';
import { LogService, StorageService } from './StorageService';

export const usePreferencias = create<{
  biometria: boolean;
  accesibilidad: boolean;
  desbloqueada: boolean;
  cargadas: boolean;
  errorBloqueo: ClaveLiteral | null;
}>(() => ({
  biometria: false,
  accesibilidad: false,
  errorBloqueo: null,
  desbloqueada: false,
  cargadas: false,
}));

export const ERROR_BLOQUEO_PENDIENTE: ClaveLiteral = 'pl_biometria_fallida_opcion';

export const setBiometria = (biometria: boolean): void => usePreferencias.setState({ biometria });
export const setAccesibilidad = (accesibilidad: boolean): void => usePreferencias.setState({ accesibilidad });
export const marcarDesbloqueada = (desbloqueada: boolean = true): void => usePreferencias.setState({ desbloqueada });

export async function cargarPreferencias(): Promise<void> {
  try {
    const [idioma, tema, biometria, accesibilidad, nombre] = await Promise.all([
      StorageService.getIdioma(),
      StorageService.getTema(),
      StorageService.getBiometria(),
      StorageService.getAccesibilidad(),
      StorageService.getUserName(),
    ]);
    if (esIdioma(idioma)) setIdioma(idioma);
    setTema(tema ?? 'oscuro');
    setBiometria(biometria);
    setAccesibilidad(accesibilidad);
    await sincronizarSimulacion(nombre);
  } catch (e) {
    LogService.error('[Preferencias] No se pudieron leer las preferencias: se usan las de por defecto', e);
    setTema('oscuro');
  } finally {
    usePreferencias.setState({ cargadas: true });
  }
}
