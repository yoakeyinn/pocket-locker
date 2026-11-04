jest.setTimeout(15000);

import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import BluetoothService from '../../src/services/BluetoothService';
import BuscarScreen from '../../src/app/buscar';
import { ModalHost } from '../../src/components/Modal';

const mockBluetooth = BluetoothService as unknown as Record<string, jest.Mock>;

jest.mock('../../src/services/BluetoothService', () => ({
  __esModule: true,
  default: {
    esSoportado: jest.fn(),
    solicitarPermisos: jest.fn(),
    tienePermisos: jest.fn(),
    estaEncendido: jest.fn(),
    pedirActivar: jest.fn(),
    listarDispositivos: jest.fn(),
    cancelarDescubrimiento: jest.fn(() => Promise.resolve()),
    abrirAjustesBluetooth: jest.fn(),
    abrirAjustesApp: jest.fn(),
    vincularDispositivo: jest.fn(),
  },
  useBluetooth: () => ({ userName: 'Ana', actualizarDispositivoVinculado: jest.fn() }),
}));

jest.mock('../../src/services/StorageService', () => ({
  DEFAULT_SECURITY_PIN: '2415',
  LogService: { warn: jest.fn() },
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

describe('BuscarScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBluetooth.esSoportado.mockResolvedValue(true);
    mockBluetooth.solicitarPermisos.mockResolvedValue(true);
    mockBluetooth.tienePermisos.mockResolvedValue(true);
    mockBluetooth.estaEncendido.mockResolvedValue(true);
    mockBluetooth.listarDispositivos.mockResolvedValue([]);
  });

  it('empieza con el radar y solo el botón de ver dispositivos manualmente', async () => {
    mockBluetooth.listarDispositivos.mockReturnValue(new Promise(() => {}));
    const { getByText, getAllByText, getByTestId, queryByTestId, queryByText } = await render(<BuscarScreen />);
    expect(getAllByText('Buscando tu Pocket Locker')).toHaveLength(1);
    expect(getByText('Ver dispositivos manualmente')).toBeTruthy();
    expect(getByTestId('btn-ir-manual')).toBeTruthy();
    expect(queryByText('Búsqueda inteligente en segundo plano')).toBeNull();
    expect(queryByTestId('btn-continuar-sin-bluetooth')).toBeNull();
    expect(getByTestId('radar-estrellas')).toBeTruthy();
    expect(queryByTestId('radar-objetivo')).toBeNull();
  });

  it('sin Bluetooth en el build muestra el aviso en la lista de dispositivos', async () => {
    mockBluetooth.esSoportado.mockResolvedValue(false);
    const { findByTestId, getByText } = await render(<BuscarScreen />);

    expect(await findByTestId('aviso-sin-bluetooth')).toBeTruthy();
    expect(getByText('Dispositivos cercanos')).toBeTruthy();
  });

  it('sin permisos explica para qué se piden antes de lanzar el diálogo del sistema', async () => {
    mockBluetooth.tienePermisos.mockResolvedValue(false);
    const { findByText, getByTestId } = await render(<BuscarScreen />);

    expect(await findByText('Permisos requeridos')).toBeTruthy();
    expect(mockBluetooth.solicitarPermisos).not.toHaveBeenCalled();

    mockBluetooth.listarDispositivos.mockReturnValue(new Promise(() => {}));
    await act(async () => {
      fireEvent.press(getByTestId('btn-conceder-permisos'));
    });
    expect(mockBluetooth.solicitarPermisos).toHaveBeenCalled();
  });

  it('al detectar el locker muestra el modal de confirmación antes de vincular', async () => {
    mockBluetooth.listarDispositivos.mockImplementation(async (alEncontrar: (d: any) => void) => {
      alEncontrar({ name: 'PLBT', address: 'AA:BB', type: 'classic' });
      return new Promise(() => {});
    });
    const { getByTestId, findByText, getByText, queryByText } = await render(<><BuscarScreen /><ModalHost /></>);

    await waitFor(() => expect(getByTestId('radar-objetivo')).toBeTruthy());
    expect(queryByText('Dispositivo detectado')).toBeNull();
    expect(queryByText(/detectado!/)).toBeNull();

    expect(await findByText('Dispositivo detectado', {}, { timeout: 3000 })).toBeTruthy();
    expect(getByText(/«PLBT»/)).toBeTruthy();
    expect(mockBluetooth.vincularDispositivo).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(getByTestId('modal-boton-derecho'));
    });

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/puertas'));
    expect(mockBluetooth.vincularDispositivo).toHaveBeenCalledWith('AA:BB');
  });

  it('si se cancela el modal pasa a la lista manual sin vincular', async () => {
    mockBluetooth.listarDispositivos
      .mockImplementationOnce(async (alEncontrar: (d: any) => void) => {
        alEncontrar({ name: 'PLBT', address: 'AA:BB', type: 'classic' });
        return new Promise(() => {});
      })
      .mockResolvedValue([]);
    const { findByText, getByTestId } = await render(<><BuscarScreen /><ModalHost /></>);

    await findByText('Dispositivo detectado', {}, { timeout: 3000 });
    await act(async () => {
      fireEvent.press(getByTestId('modal-boton-izquierdo'));
    });

    expect(await findByText('Dispositivos cercanos')).toBeTruthy();
    expect(mockBluetooth.vincularDispositivo).not.toHaveBeenCalled();
  });
});
