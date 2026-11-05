jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('react-native-bluetooth-classic', () => ({ __esModule: true, default: {} }));
jest.mock('react-native-ble-plx', () => ({ BleManager: jest.fn() }));

import { Biometria } from '../../src/services/Biometria';
import BluetoothService, { DispositivoBT, usePocketStore } from '../../src/services/BluetoothService';
import {
  activarSimulacion,
  BUSQUEDA_SIMULADA_MS,
  PLBT_APARECE_MS,
  desactivarSimulacion,
  DISPOSITIVO_SIMULADO,
  DISPOSITIVOS_SIMULADOS,
  esNombreDemo,
  estaSimulando,
  sincronizarSimulacion,
} from '../../src/services/Simulacion';
import { esLocker } from '../../src/services/comun';

describe('modo demo (simulación activada por el nombre «demo»)', () => {
  afterEach(async () => {
    jest.useRealTimers();
    await desactivarSimulacion();
  });

  it('solo el nombre «demo» (sin importar mayúsculas ni espacios) activa la simulación', () => {
    for (const nombre of ['demo', 'Demo', '  DEMO  ']) expect(esNombreDemo(nombre)).toBe(true);
    for (const nombre of ['demos', 'de mo', 'Ana', '', null, undefined]) expect(esNombreDemo(nombre)).toBe(false);
  });

  it('sin activar nada no se simula', () => {
    expect(estaSimulando()).toBe(false);
  });

  it('sincronizarSimulacion activa con «demo» y desactiva con cualquier otro nombre', async () => {
    await sincronizarSimulacion('demo');
    expect(estaSimulando()).toBe(true);
    await sincronizarSimulacion('Ana');
    expect(estaSimulando()).toBe(false);
  });

  it('activar dos veces no pierde las funciones originales: al desactivar vuelven', async () => {
    const original = BluetoothService.listarDispositivos;
    activarSimulacion();
    activarSimulacion();
    expect(BluetoothService.listarDispositivos).not.toBe(original);
    await desactivarSimulacion();
    expect(BluetoothService.listarDispositivos).toBe(original);
  });

  it('simula un adaptador disponible, encendido y con permisos', async () => {
    activarSimulacion();
    expect(await BluetoothService.esSoportado()).toBe(true);
    expect(await BluetoothService.estaEncendido()).toBe(true);
    expect(await BluetoothService.tienePermisos()).toBe(true);
  });

  it('la búsqueda encuentra diez dispositivos y van saliendo repartidos; el PLBT aparece a los 5 s, el segundo', async () => {
    activarSimulacion();
    jest.useFakeTimers();
    const encontrados: DispositivoBT[] = [];
    const busqueda = BluetoothService.listarDispositivos((dev) => encontrados.push(dev));
    await jest.advanceTimersByTimeAsync(PLBT_APARECE_MS - 1);
    expect(encontrados.length).toBe(1);
    expect(encontrados).not.toContainEqual(DISPOSITIVO_SIMULADO);
    await jest.advanceTimersByTimeAsync(1);
    expect(encontrados[1]).toEqual(DISPOSITIVO_SIMULADO);
    await jest.advanceTimersByTimeAsync(BUSQUEDA_SIMULADA_MS + 1000);
    const lista = await busqueda;
    expect(lista).toHaveLength(10);
    expect(lista[1]).toEqual(DISPOSITIVO_SIMULADO);
    expect(new Set(lista.map((d) => d.address)).size).toBe(10);
  });

  it('solo el PLBT es un locker: los señuelos no lo son', () => {
    expect(DISPOSITIVOS_SIMULADOS.filter(({ dispositivo }) => esLocker(dispositivo))).toHaveLength(1);
    expect(esLocker(DISPOSITIVO_SIMULADO)).toBe(true);
  });

  it('conecta y manda comandos como si hubiera un candado real', async () => {
    activarSimulacion();
    jest.useFakeTimers();
    await usePocketStore.getState().inicializar();
    const accion = (async () => {
      await usePocketStore.getState().conectarDispositivo(DISPOSITIVO_SIMULADO.address, 'classic');
      await BluetoothService.enviarComando('P');
    })();
    await jest.advanceTimersByTimeAsync(15000);
    await accion;
    expect(await BluetoothService.estaConectado()).toBe(true);
  });

  it('la huella NO se simula: el modo demo deja la autenticación del teléfono tal cual', async () => {
    const metodo = Biometria.metodo;
    const autenticar = Biometria.autenticar;
    activarSimulacion();
    expect(Biometria.metodo).toBe(metodo);
    expect(Biometria.autenticar).toBe(autenticar);
  });

  it('al salir del modo demo se olvida el locker simulado que se hubiera vinculado', async () => {
    activarSimulacion();
    usePocketStore.setState({ deviceMac: DISPOSITIVO_SIMULADO.address, deviceName: 'PLBT', status: 'disconnected' });
    await sincronizarSimulacion('Ana');
    expect(usePocketStore.getState().deviceMac).toBeNull();
  });

  it('al salir del modo demo no toca un locker real', async () => {
    activarSimulacion();
    usePocketStore.setState({ deviceMac: '00:11:22:33:44:55', deviceName: 'Real', status: 'disconnected' });
    await sincronizarSimulacion('Ana');
    expect(usePocketStore.getState().deviceMac).toBe('00:11:22:33:44:55');
    usePocketStore.setState({ deviceMac: null, deviceName: null });
  });
});
