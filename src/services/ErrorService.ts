import { LogBox, Platform } from 'react-native';
import { mostrarModalError } from '../components/Modal';
import { t } from '../styles/i18n';
import { usePocketStore } from './BluetoothService';
import { LogService } from './StorageService';

const VERSION: string = require('../../package.json').version;
const LINEAS_DE_REGISTRO = 120;

function describirError(error: unknown): string {
  if (error instanceof Error) {
    const causa = (error as { cause?: unknown }).cause;
    return [
      `${error.name}: ${error.message}`,
      error.stack ? `Pila:\n${error.stack}` : 'Pila: (no disponible)',
      causa ? `Causa: ${describirError(causa)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }
  try {
    return typeof error === 'string' ? error : JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

export function construirInforme(error: unknown, contexto: string): string {
  const { status, deviceName, deviceMac, deviceType, cargando } = usePocketStore.getState();
  const registro = LogService.getLogs()
    .slice(0, LINEAS_DE_REGISTRO)
    .reverse()
    .map((l) => `${l.timestamp} [${l.level.toUpperCase()}] ${l.message}${l.extra ? `\n${l.extra}` : ''}`);

  return [
    `${t('pl_app_titulo')} v${VERSION} - informe de error`,
    `Fecha: ${new Date().toISOString()}`,
    `Plataforma: ${Platform.OS} ${String(Platform.Version)}`,
    `Estado: bluetooth=${status}, cargando=${cargando}, dispositivo=${deviceName ?? '-'} (${deviceMac ?? '-'}), tipo=${deviceType}`,
    `Contexto: ${contexto}`,
    '',
    'ERROR',
    describirError(error),
    '',
    `REGISTRO (ultimas ${LINEAS_DE_REGISTRO} entradas, de antigua a reciente)`,
    ...registro,
  ].join('\n');
}

export function reportarErrorFatal(error: unknown, contexto: string): void {
  LogService.error(`[FATAL] ${contexto}`, error);
  try {
    mostrarModalError(t('pl_error_titulo'), t('pl_error_mensaje', { app: t('pl_app_titulo') }), construirInforme(error, contexto));
  } catch (fallo) {
    LogService.error('[FATAL] No se pudo mostrar el modal de error', fallo);
  }
}

let capturaInstalada = false;

export function instalarCapturaDeErrores(): void {
  if (capturaInstalada) return;
  capturaInstalada = true;

  LogBox.ignoreAllLogs(true);

  const utilidades = (globalThis as { ErrorUtils?: any }).ErrorUtils;
  utilidades?.setGlobalHandler?.((error: unknown, esFatal?: boolean) => {
    if (esFatal) reportarErrorFatal(error, 'Excepcion de JavaScript no controlada');
    else LogService.error('Excepcion de JavaScript no fatal', error);
  });

  try {
    (globalThis as { HermesInternal?: any }).HermesInternal?.enablePromiseRejectionTracker?.({
      allRejections: true,
      onUnhandled: (_id: number, error: unknown) => LogService.error('Promesa rechazada sin capturar', error),
    });
  } catch (e) {
    LogService.warn('No se pudo activar el registro de promesas rechazadas', e);
  }
}
