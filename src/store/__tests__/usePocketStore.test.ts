import { renderHook, act } from '@testing-library/react-native';
import { usePocketStore } from '../usePocketStore';
import BluetoothService from '../../services/BluetoothService';
import StorageService, { DEFAULT_SECURITY_PIN } from '../../services/StorageService';

// Mock de StorageService
jest.mock('../../services/StorageService', () => ({
  __esModule: true,
  DEFAULT_SECURITY_PIN: '2415',
  parsearYValidarPin: jest.fn().mockReturnValue({
    esValido: true,
    esAdmin: true,
    peatonal: true,
    garaje: true,
    dias: null,
  }),
  default: {
    getDeviceMac: jest.fn(),
    getDeviceName: jest.fn(),
    getDeviceType: jest.fn().mockResolvedValue('classic'),
    getDevicePin: jest.fn().mockResolvedValue('2415'),
    saveDevice: jest.fn().mockResolvedValue(undefined),
    saveDevicePin: jest.fn().mockResolvedValue(undefined),
    clearDevice: jest.fn().mockResolvedValue(undefined),
    obtenerDispositivo: jest.fn(),
    getUltimaPuerta: jest.fn().mockResolvedValue('peatonal'),
    saveUltimaPuerta: jest.fn().mockResolvedValue(undefined),
    updateUserStatus: jest.fn().mockResolvedValue(undefined),
    getUserName: jest.fn().mockResolvedValue(null),
    saveUserName: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock de BluetoothService
jest.mock('../../services/BluetoothService', () => ({
  __esModule: true,
  default: {
    esSoportado: jest.fn().mockResolvedValue(true),
    estaEncendido: jest.fn().mockResolvedValue(true),
    solicitarPermisos: jest.fn().mockResolvedValue(true),
    conectar: jest.fn().mockResolvedValue(undefined),
    desconectar: jest.fn().mockResolvedValue(undefined),
    enviarComando: jest.fn().mockResolvedValue(undefined),
    enviarComandoConRespuesta: jest.fn().mockResolvedValue('OK:PUERTA'),
    enviarComandoEsperarLineas: jest.fn().mockResolvedValue([
      'USER:11:22:33:44:55:66:Maria:1:1:15:ACTIVO',
      'USER:AA:BB:CC:DD:EE:FF:Juan:1:0:0:BLOQUEADO',
      'END:USERS',
    ]),
    estaConectado: jest.fn().mockResolvedValue(false),
    registrarOnDesconexion: jest.fn(),
    registrarOnDatosRecibidos: jest.fn(),
  },
}));

// Mock de LogService
jest.mock('../../services/LogService', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Zustand usePocketStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePocketStore.getState().resetStore();
  });

  it('debería tener el estado inicial esperado', () => {
    const state = usePocketStore.getState();
    expect(state.status).toBe('disconnected');
    expect(state.deviceMac).toBeNull();
    expect(state.deviceName).toBeNull();
    expect(state.devicePin).toBe(DEFAULT_SECURITY_PIN);
    expect(state.cargando).toBe(true);
    expect(state.tiempoRestanteBloqueo).toBe(0);
    expect(state.ultimaPuerta).toBe('peatonal');
    expect(state.userRole).toBe('user');
    expect(state.userName).toBeNull();
    expect(state.isDemoMode).toBe(false);
  });

  it('permite acceso y actualización fuera del ciclo de vida de React (getState / setState)', () => {
    usePocketStore.setState({ status: 'connected', deviceName: 'Pocket Locker Alba' });
    expect(usePocketStore.getState().status).toBe('connected');
    expect(usePocketStore.getState().deviceName).toBe('Pocket Locker Alba');
  });

  it('soporta selectores atómicos de React para prevenir renders globales innecesarios', async () => {
    const { result } = await renderHook(() => usePocketStore((s) => s.status));
    expect(result.current).toBe('disconnected');

    await act(async () => {
      usePocketStore.setState({ status: 'connected' });
    });
    expect(result.current).toBe('connected');
  });

  it('inicia y descuenta el tiempo de bloqueo de margen', () => {
    usePocketStore.getState().iniciarBloqueoMargen(5);
    expect(usePocketStore.getState().tiempoRestanteBloqueo).toBe(5);

    usePocketStore.getState().resetStore();
    expect(usePocketStore.getState().tiempoRestanteBloqueo).toBe(0);
  });

  it('guarda la última puerta y persiste en StorageService', async () => {
    await usePocketStore.getState().guardarUltimaPuerta('garaje');
    expect(usePocketStore.getState().ultimaPuerta).toBe('garaje');
    expect(StorageService.saveUltimaPuerta).toHaveBeenCalledWith('garaje');
  });

  it('activa y desactiva el modo DEMO', async () => {
    (StorageService.obtenerDispositivo as jest.Mock).mockResolvedValue({
      mac: '00:11:22:33:44:55',
      name: 'Real Locker',
      type: 'classic',
      pin: '2415',
      role: 'admin',
      permisos: { peatonal: true, garaje: true },
      diasRestantes: 30,
      estaBloqueado: false,
    });
    (StorageService.getUserName as jest.Mock).mockResolvedValue('Alba');

    await usePocketStore.getState().activarModoDemo();
    expect(usePocketStore.getState().isDemoMode).toBe(true);
    expect(usePocketStore.getState().status).toBe('connected');
    expect(usePocketStore.getState().deviceName).toBe('Pocket Locker (DEMO)');

    await usePocketStore.getState().desactivarModoDemo();
    expect(usePocketStore.getState().isDemoMode).toBe(false);
    expect(usePocketStore.getState().deviceName).toBe('Real Locker');
    expect(usePocketStore.getState().userName).toBe('Alba');
  });

  it('actualiza el dispositivo vinculado y conecta', async () => {
    await usePocketStore
      .getState()
      .actualizarDispositivoVinculado('AA:BB:CC:DD:EE:FF', 'Locker Alba', 'classic', '2415', 'Alba');

    expect(StorageService.saveDevice).toHaveBeenCalledWith(
      'AA:BB:CC:DD:EE:FF',
      'Locker Alba',
      'classic',
      '2415',
      'Alba'
    );
    expect(usePocketStore.getState().deviceMac).toBe('AA:BB:CC:DD:EE:FF');
    expect(usePocketStore.getState().deviceName).toBe('Locker Alba');
    expect(usePocketStore.getState().status).toBe('connected');
    expect(BluetoothService.conectar).toHaveBeenCalledWith('AA:BB:CC:DD:EE:FF', 'classic');
  });

  it('transmite tramas seguras con normalización de comandos (P -> E, G -> H)', async () => {
    usePocketStore.setState({
      status: 'connected',
      deviceMac: '00:11:22:33:44:55',
      deviceType: 'classic',
      devicePin: '2415',
    });

    await usePocketStore.getState().enviarComando('P');
    expect(BluetoothService.enviarComandoConRespuesta).toHaveBeenCalledWith('PLK:2415:E', 'classic');

    await usePocketStore.getState().enviarComando('G');
    expect(BluetoothService.enviarComandoConRespuesta).toHaveBeenCalledWith('PLK:2415:H', 'classic');
  });

  it('gestiona usuarios de administrador (listar, desbloquear, modificar, eliminar)', async () => {
    usePocketStore.setState({
      status: 'connected',
      deviceMac: '00:11:22:33:44:55',
      deviceType: 'classic',
    });

    const usuarios = await usePocketStore.getState().obtenerListaUsuarios();
    expect(usuarios.length).toBe(2);
    expect(usuarios[0].nombre).toBe('Maria');
    expect(usuarios[1].nombre).toBe('Juan');

    (BluetoothService.enviarComandoConRespuesta as jest.Mock).mockResolvedValueOnce('OK:UNBLOCKED');
    const desbloqueado = await usePocketStore.getState().desbloquearUsuario('AA:BB:CC:DD:EE:FF');
    expect(desbloqueado).toBe(true);

    (BluetoothService.enviarComandoConRespuesta as jest.Mock).mockResolvedValueOnce('OK:USER_UPDATED');
    const modificado = await usePocketStore.getState().modificarUsuario('AA:BB:CC:DD:EE:FF', 30, true, true);
    expect(modificado).toBe(true);

    (BluetoothService.enviarComandoConRespuesta as jest.Mock).mockResolvedValueOnce('OK:USER_DELETED');
    const eliminado = await usePocketStore.getState().eliminarUsuario('AA:BB:CC:DD:EE:FF');
    expect(eliminado).toBe(true);
  });
});
