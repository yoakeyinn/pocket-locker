import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { BluetoothProvider, useBluetooth } from '../BluetoothContext';
import BluetoothService from '../../services/BluetoothService';
import StorageService, { DEFAULT_SECURITY_PIN } from '../../services/StorageService';

// Mock de StorageService
jest.mock('../../services/StorageService', () => ({
  __esModule: true,
  DEFAULT_SECURITY_PIN: '7492',
  default: {
    getDeviceMac: jest.fn(),
    getDeviceName: jest.fn(),
    getDevicePin: jest.fn().mockResolvedValue('7492'),
    saveDevice: jest.fn().mockResolvedValue(undefined),
    saveDevicePin: jest.fn().mockResolvedValue(undefined),
    clearDevice: jest.fn().mockResolvedValue(undefined),
    obtenerDispositivo: jest.fn(),
  },
}));

// Mock de react-native-bluetooth-classic
jest.mock('react-native-bluetooth-classic', () => ({
  __esModule: true,
  default: {
    onBluetoothEnabled: jest.fn().mockReturnValue({ remove: jest.fn() }),
    onBluetoothDisabled: jest.fn().mockReturnValue({ remove: jest.fn() }),
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
    estaConectado: jest.fn().mockResolvedValue(false),
    registrarOnDesconexion: jest.fn(),
    registrarOnDatosRecibidos: jest.fn(),
  },
}));

// Mock de LogService para mantener la consola de los tests limpia
jest.mock('../../services/LogService', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('BluetoothContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debería inicializar con estado unpaired si no hay MAC guardada', async () => {
    (StorageService.obtenerDispositivo as jest.Mock).mockResolvedValue({
      mac: null,
      name: null,
      type: 'classic',
      pin: DEFAULT_SECURITY_PIN,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BluetoothProvider>{children}</BluetoothProvider>
    );

    const { result } = await renderHook(() => useBluetooth(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe('unpaired');
    });

    expect(result.current.deviceMac).toBeNull();
    expect(result.current.deviceName).toBeNull();
  });

  it('debería inicializar y conectar si hay una MAC guardada', async () => {
    (StorageService.obtenerDispositivo as jest.Mock).mockResolvedValue({
      mac: '00:11:22:33:44:55',
      name: 'PocketLocker BT',
      type: 'classic',
      pin: '7492',
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BluetoothProvider>{children}</BluetoothProvider>
    );

    const { result } = await renderHook(() => useBluetooth(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe('connected');
    });

    expect(result.current.deviceMac).toBe('00:11:22:33:44:55');
    expect(result.current.deviceName).toBe('PocketLocker BT');
    expect(BluetoothService.conectar).toHaveBeenCalledWith('00:11:22:33:44:55', 'classic');
  });

  it('debería actualizar el dispositivo vinculado y conectar', async () => {
    (StorageService.obtenerDispositivo as jest.Mock).mockResolvedValue({
      mac: null,
      name: null,
      type: 'classic',
      pin: DEFAULT_SECURITY_PIN,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BluetoothProvider>{children}</BluetoothProvider>
    );

    const { result } = await renderHook(() => useBluetooth(), { wrapper });

    await act(async () => {
      await result.current.actualizarDispositivoVinculado('AA:BB:CC:DD:EE:FF', 'Nuevo Locker');
    });

    expect(StorageService.saveDevice).toHaveBeenCalledWith(
      'AA:BB:CC:DD:EE:FF',
      'Nuevo Locker',
      'classic',
      '7492'
    );
    expect(result.current.deviceMac).toBe('AA:BB:CC:DD:EE:FF');
    expect(result.current.deviceName).toBe('Nuevo Locker');
    expect(result.current.status).toBe('connected');
  });

  it('debería desvincular el dispositivo y limpiar AsyncStorage', async () => {
    (StorageService.obtenerDispositivo as jest.Mock).mockResolvedValue({
      mac: '00:11:22:33:44:55',
      name: 'PocketLocker BT',
      type: 'classic',
      pin: '7492',
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BluetoothProvider>{children}</BluetoothProvider>
    );

    const { result } = await renderHook(() => useBluetooth(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe('connected');
    });

    await act(async () => {
      await result.current.desvincularDispositivo();
    });

    expect(StorageService.clearDevice).toHaveBeenCalled();
    expect(result.current.deviceMac).toBeNull();
    expect(result.current.deviceName).toBeNull();
    expect(result.current.status).toBe('unpaired');
    expect(BluetoothService.desconectar).toHaveBeenCalled();
  });

  it('debería renombrar el dispositivo y actualizar el almacenamiento', async () => {
    (StorageService.obtenerDispositivo as jest.Mock).mockResolvedValue({
      mac: '00:11:22:33:44:55',
      name: 'PocketLocker BT',
      type: 'classic',
      pin: '7492',
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BluetoothProvider>{children}</BluetoothProvider>
    );

    const { result } = await renderHook(() => useBluetooth(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe('connected');
    });

    await act(async () => {
      await result.current.renombrarDispositivo('Nuevo Nombre');
    });

    expect(StorageService.saveDevice).toHaveBeenCalledWith(
      '00:11:22:33:44:55',
      'Nuevo Nombre',
      'classic',
      '7492'
    );
    expect(result.current.deviceName).toBe('Nuevo Nombre');
  });

  it('debería actualizar el PIN de seguridad del dispositivo', async () => {
    (StorageService.obtenerDispositivo as jest.Mock).mockResolvedValue({
      mac: '00:11:22:33:44:55',
      name: 'PocketLocker BT',
      type: 'classic',
      pin: '7492',
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BluetoothProvider>{children}</BluetoothProvider>
    );

    const { result } = await renderHook(() => useBluetooth(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe('connected');
    });

    await act(async () => {
      await result.current.actualizarPinDispositivo('9999');
    });

    expect(StorageService.saveDevicePin).toHaveBeenCalledWith('9999');
    expect(result.current.devicePin).toBe('9999');
  });

  it('debería enviar la trama segura PLK:<PIN>:<CMD> al invocar enviarComando', async () => {
    (StorageService.obtenerDispositivo as jest.Mock).mockResolvedValue({
      mac: '00:11:22:33:44:55',
      name: 'PocketLocker BT',
      type: 'classic',
      pin: '7492',
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BluetoothProvider>{children}</BluetoothProvider>
    );

    const { result } = await renderHook(() => useBluetooth(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe('connected');
    });

    await act(async () => {
      await result.current.enviarComando('E');
    });

    expect(BluetoothService.enviarComandoConRespuesta).toHaveBeenCalledWith('PLK:7492:E', 'classic');
  });
});
