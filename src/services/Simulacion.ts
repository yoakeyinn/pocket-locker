import { create } from 'zustand';
import BluetoothService, { DispositivoBT, usePocketStore } from './BluetoothService';
import { LogService } from './StorageService';

export const NOMBRE_DEMO = 'demo';
export const esNombreDemo = (nombre?: string | null): boolean => (nombre ?? '').trim().toLowerCase() === NOMBRE_DEMO;

export const DISPOSITIVO_SIMULADO: DispositivoBT = { name: 'PLBT', address: 'AA:BB:CC:DD:EE:FF', type: 'classic' };

export const BUSQUEDA_SIMULADA_MS = 10000;
export const PLBT_APARECE_MS = 5000;

export const DISPOSITIVOS_SIMULADOS: { dispositivo: DispositivoBT; apareceMs: number }[] = [
  { dispositivo: { name: 'JBL Flip 5', address: '11:22:33:44:55:01', type: 'classic' }, apareceMs: 3000 },
  { dispositivo: DISPOSITIVO_SIMULADO, apareceMs: PLBT_APARECE_MS },
  { dispositivo: { name: 'Mi Band 7', address: '11:22:33:44:55:03', type: 'ble' }, apareceMs: 6000 },
  { dispositivo: { name: 'Galaxy Buds2', address: '11:22:33:44:55:04', type: 'classic' }, apareceMs: 6700 },
  { dispositivo: { name: 'TV Salón', address: '11:22:33:44:55:05', type: 'classic' }, apareceMs: 7400 },
  { dispositivo: { name: 'Altavoz Cocina', address: '11:22:33:44:55:06', type: 'classic' }, apareceMs: 8100 },
  { dispositivo: { name: 'Reloj Pulsera', address: '11:22:33:44:55:07', type: 'ble' }, apareceMs: 8800 },
  { dispositivo: { name: 'Auriculares Sony', address: '11:22:33:44:55:08', type: 'classic' }, apareceMs: 9500 },
  { dispositivo: { name: 'Barra de Sonido', address: '11:22:33:44:55:09', type: 'classic' }, apareceMs: 10200 },
  { dispositivo: { name: 'Teclado BT', address: '11:22:33:44:55:10', type: 'ble' }, apareceMs: 10900 },
];

export const useSimulacion = create<{ activa: boolean }>(() => ({ activa: false }));
export const estaSimulando = (): boolean => useSimulacion.getState().activa;

const esperar = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

function crearSimulacion() {
  let conectado = false;

  const bluetooth = {
    esSoportado: async () => true,
    estaEncendido: async () => true,
    tienePermisos: async () => true,
    solicitarPermisos: async () => true,
    pedirActivar: async () => true,
    cancelarDescubrimiento: async () => {},
    vincularDispositivo: async () => true,
    desvincularDispositivo: async () => true,
    listarDispositivos: async (alEncontrar?: (dev: DispositivoBT) => void) => {
      let transcurrido = 0;
      for (const { dispositivo, apareceMs } of DISPOSITIVOS_SIMULADOS) {
        await esperar(apareceMs - transcurrido);
        transcurrido = apareceMs;
        alEncontrar?.(dispositivo);
      }
      await esperar(BUSQUEDA_SIMULADA_MS + 1000 - transcurrido);
      return DISPOSITIVOS_SIMULADOS.map(({ dispositivo }) => dispositivo);
    },
    conectar: async () => {
      await esperar(900);
      conectado = true;
    },
    desconectar: async () => {
      conectado = false;
    },
    estaConectado: async () => conectado,
    enviarComando: async () => {},
    enviarComandoConRespuesta: async () => {
      await esperar(600);
      return 'OK:SIMULADO';
    },
  };

  return bluetooth;
}

let originales: Record<string, unknown> | null = null;

const guardar = (objeto: Record<string, unknown>, claves: string[]) =>
  Object.fromEntries(claves.map((clave) => [clave, objeto[clave]]));

export function activarSimulacion(): void {
  if (originales) return;
  const bluetooth = crearSimulacion();
  originales = guardar(BluetoothService as any, Object.keys(bluetooth));
  Object.assign(BluetoothService as any, bluetooth);
  useSimulacion.setState({ activa: true });
  LogService.info('[Simulación] Modo demo activado');
}

export async function desactivarSimulacion(): Promise<void> {
  if (!originales) return;
  Object.assign(BluetoothService as any, originales);
  originales = null;
  useSimulacion.setState({ activa: false });
  LogService.info('[Simulación] Modo demo desactivado');

  const { deviceMac, desvincularDispositivo } = usePocketStore.getState();
  if (deviceMac === DISPOSITIVO_SIMULADO.address) {
    await desvincularDispositivo().catch((e) => LogService.warn('[Simulación] No se pudo olvidar el locker simulado', e));
  }
}

export async function sincronizarSimulacion(nombre?: string | null): Promise<void> {
  if (esNombreDemo(nombre)) activarSimulacion();
  else await desactivarSimulacion();
}
