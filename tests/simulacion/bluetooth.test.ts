jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native-bluetooth-classic', () => ({ __esModule: true, default: {} }));
jest.mock('react-native-ble-plx', () => ({ BleManager: jest.fn() }));

import { BluetoothService, DispositivoBT, usePocketStore } from '../../src/services/BluetoothService';
import StorageService from '../../src/services/StorageService';
import { esLocker } from '../../src/services/comun';
import { BUSQUEDA_SIMULADA_MS, DISPOSITIVOS_SIMULADOS, DISPOSITIVO_SIMULADO, GUARDADO_SIMULADO, instalarSimulacion } from './bluetooth';

describe('simulación de Bluetooth (npm run simular)', () => {
  beforeAll(() => instalarSimulacion('1'));

  it('simula un adaptador disponible, encendido y con permisos', async () => {
    expect(await BluetoothService.esSoportado()).toBe(true);
    expect(await BluetoothService.estaEncendido()).toBe(true);
    expect(await BluetoothService.tienePermisos()).toBe(true);
  });

  it('arranca con un dispositivo vinculado si no hay ninguno guardado', async () => {
    expect(await StorageService.obtenerDispositivo()).toEqual(GUARDADO_SIMULADO);
  });

  it('la búsqueda encuentra siete dispositivos y el PLBT aparece a los 10 s, el cuarto', async () => {
    jest.useFakeTimers();
    const encontrados: DispositivoBT[] = [];
    const busqueda = BluetoothService.listarDispositivos((dev) => encontrados.push(dev));
    await jest.advanceTimersByTimeAsync(BUSQUEDA_SIMULADA_MS - 1);
    expect(encontrados.length).toBe(3);
    expect(encontrados).not.toContainEqual(DISPOSITIVO_SIMULADO);
    await jest.advanceTimersByTimeAsync(1);
    expect(encontrados[3]).toEqual(DISPOSITIVO_SIMULADO);
    await jest.advanceTimersByTimeAsync(1000);
    const lista = await busqueda;
    expect(lista).toHaveLength(7);
    expect(lista[3]).toEqual(DISPOSITIVO_SIMULADO);
    expect(new Set(lista.map((d) => d.address)).size).toBe(7);
    jest.useRealTimers();
  });

  it('solo el PLBT es un locker: los señuelos no lo son', () => {
    expect(DISPOSITIVOS_SIMULADOS.filter(({ dispositivo }) => esLocker(dispositivo))).toHaveLength(1);
    expect(esLocker(DISPOSITIVO_SIMULADO)).toBe(true);
  });

  it('conecta y manda comandos como si hubiera un candado real', async () => {
    jest.useFakeTimers();
    const store = usePocketStore.getState();
    const accion = (async () => {
      await store.inicializar();
      await usePocketStore.getState().enviarComando('P');
    })();
    await jest.advanceTimersByTimeAsync(15000);
    await accion;
    expect(usePocketStore.getState().status).toBe('connected');
    jest.useRealTimers();
  });

  it('con la opción bluetooth-apagado simula el Bluetooth apagado hasta que se enciende', async () => {
    instalarSimulacion('bluetooth-apagado');
    expect(await BluetoothService.estaEncendido()).toBe(false);
    jest.useFakeTimers();
    const encender = BluetoothService.pedirActivar();
    await jest.advanceTimersByTimeAsync(1000);
    expect(await encender).toBe(true);
    jest.useRealTimers();
    expect(await BluetoothService.estaEncendido()).toBe(true);
  });
});
