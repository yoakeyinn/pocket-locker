import { BluetoothService, DispositivoBT } from '../../src/services/BluetoothService';
import StorageService, { DispositivoGuardado } from '../../src/services/StorageService';
import { DEFAULT_SECURITY_PIN } from '../../src/services/comun';

export const DISPOSITIVO_SIMULADO: DispositivoBT = { name: 'PLBT', address: 'AA:BB:CC:DD:EE:FF', type: 'classic' };

export const GUARDADO_SIMULADO: DispositivoGuardado = {
  mac: DISPOSITIVO_SIMULADO.address,
  name: 'Locker de prueba',
  userName: 'Demo',
  type: 'classic',
  pin: DEFAULT_SECURITY_PIN,
};

export const BUSQUEDA_SIMULADA_MS = 10000;

// Siete dispositivos para revisar la lista con «Ver más»: el PLBT aparece el cuarto (a los 10 s, cuando
// también lo detecta el radar) y los demás son señuelos que la app rechaza al vincular (no son un locker).
export const DISPOSITIVOS_SIMULADOS: { dispositivo: DispositivoBT; apareceMs: number }[] = [
  { dispositivo: { name: 'JBL Flip 5', address: '11:22:33:44:55:01', type: 'classic' }, apareceMs: 3000 },
  { dispositivo: { name: 'Galaxy Buds2', address: '11:22:33:44:55:02', type: 'classic' }, apareceMs: 5000 },
  { dispositivo: { name: 'Mi Band 7', address: '11:22:33:44:55:03', type: 'ble' }, apareceMs: 7000 },
  { dispositivo: DISPOSITIVO_SIMULADO, apareceMs: BUSQUEDA_SIMULADA_MS },
  { dispositivo: { name: 'TV Salón', address: '11:22:33:44:55:05', type: 'classic' }, apareceMs: BUSQUEDA_SIMULADA_MS + 200 },
  { dispositivo: { name: 'Altavoz Cocina', address: '11:22:33:44:55:06', type: 'classic' }, apareceMs: BUSQUEDA_SIMULADA_MS + 400 },
  { dispositivo: { name: 'Reloj Pulsera', address: '11:22:33:44:55:07', type: 'ble' }, apareceMs: BUSQUEDA_SIMULADA_MS + 600 },
];

const esperar = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

export function instalarSimulacion(modo: string = '1'): void {
  const opciones = modo.split(',');
  let conectado = false;
  let encendido = !opciones.includes('bluetooth-apagado');

  const abrirAjustesReales = BluetoothService.abrirAjustesBluetooth.bind(BluetoothService);

  Object.assign(BluetoothService as any, {
    esSoportado: async () => true,
    estaEncendido: async () => encendido,
    tienePermisos: async () => true,
    solicitarPermisos: async () => true,
    pedirActivar: async () => {
      await esperar(600);
      encendido = true;
      return true;
    },
    cancelarDescubrimiento: async () => {},
    abrirAjustesBluetooth: async () => {
      await abrirAjustesReales().catch(() => {});
      encendido = true;
    },
    abrirAjustesApp: async () => {},
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
  });

  if (!opciones.includes('sin-vincular')) {
    const original = StorageService.obtenerDispositivo.bind(StorageService);
    (StorageService as any).obtenerDispositivo = async () => {
      const real = await original();
      return real.mac ? real : GUARDADO_SIMULADO;
    };
  }
}
