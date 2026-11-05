jest.setTimeout(15000);

import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import BluetoothService from '../../src/services/BluetoothService';
import BuscarScreen from '../../src/app/buscar';

const mockBluetooth = BluetoothService as unknown as Record<string, jest.Mock>;
const mockActualizar = jest.fn();

jest.mock('../../src/services/BluetoothService', () => ({
  __esModule: true,
  SIN_NOMBRE: 'Sin nombre',
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
  useBluetooth: () => ({ userName: 'Ana', actualizarDispositivoVinculado: mockActualizar }),
}));

jest.mock('../../src/services/StorageService', () => ({
  LogService: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

const SENUELO = { name: 'JBL Flip 5', address: '11:22', type: 'classic' };
const LOCKER = { name: 'PLBT', address: 'AA:BB', type: 'classic' };

async function abrirModalDe(nombre: string) {
  mockBluetooth.listarDispositivos
    .mockImplementationOnce(() => new Promise(() => {}))
    .mockResolvedValue([SENUELO, LOCKER]);
  const pantalla = await render(<BuscarScreen />);
  await act(async () => {
    fireEvent.press(pantalla.getByTestId('btn-ir-manual'));
  });
  await pantalla.findByText(nombre);
  await act(async () => {
    fireEvent.press(pantalla.getByText(nombre));
  });
  return pantalla;
}

const vincular = async (pantalla: Awaited<ReturnType<typeof render>>, pin: string) => {
  await act(async () => {
    fireEvent.changeText(pantalla.getByTestId('input-pin'), pin);
  });
  await act(async () => {
    fireEvent.press(pantalla.getByTestId('modal-boton-derecho'));
  });
};

describe('vincular desde la lista manual (errores dentro del modal)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBluetooth.esSoportado.mockResolvedValue(true);
    mockBluetooth.solicitarPermisos.mockResolvedValue(true);
    mockBluetooth.tienePermisos.mockResolvedValue(true);
    mockBluetooth.estaEncendido.mockResolvedValue(true);
    mockBluetooth.vincularDispositivo.mockResolvedValue(true);
  });

  it('con el PIN vacío muestra el error bajo el campo del PIN y no empareja', async () => {
    const pantalla = await abrirModalDe('PLBT');
    await vincular(pantalla, '');

    expect(pantalla.getByTestId('error-pin')).toBeTruthy();
    expect(pantalla.getByText('Introduce el PIN de seguridad.')).toBeTruthy();
    expect(mockBluetooth.vincularDispositivo).not.toHaveBeenCalled();
  });

  it('con un PIN incorrecto lo dice bajo el campo del PIN, sin revelar el PIN', async () => {
    const pantalla = await abrirModalDe('PLBT');
    await vincular(pantalla, '1234');

    expect(pantalla.getByText('El PIN introducido no es correcto.')).toBeTruthy();
    expect(pantalla.queryByText(/2415/)).toBeNull();
    expect(mockBluetooth.vincularDispositivo).not.toHaveBeenCalled();
  });

  it('un dispositivo que no es el locker da el error bajo el campo del nombre, sin emparejar', async () => {
    const pantalla = await abrirModalDe('JBL Flip 5');
    await vincular(pantalla, '2415');

    expect(pantalla.getByTestId('error-nombre')).toBeTruthy();
    expect(pantalla.getByText(/no corresponde con tu Pocket Locker/)).toBeTruthy();
    expect(mockBluetooth.vincularDispositivo).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('el error desaparece al editar el campo', async () => {
    const pantalla = await abrirModalDe('JBL Flip 5');
    await vincular(pantalla, '2415');
    await act(async () => {
      fireEvent.changeText(pantalla.getByTestId('input-nombre'), 'Otro');
    });
    expect(pantalla.queryByTestId('error-nombre')).toBeNull();
  });

  it('si el emparejamiento falla por otro motivo, lo indica bajo el nombre', async () => {
    mockBluetooth.vincularDispositivo.mockRejectedValue(new Error('rechazado'));
    const pantalla = await abrirModalDe('PLBT');
    await vincular(pantalla, '2415');

    expect(pantalla.getByText(/no se ha podido completar/)).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('acepta también un código de usuario 2S0BP y lo guarda tal cual', async () => {
    const pantalla = await abrirModalDe('PLBT');
    await vincular(pantalla, '2s0bp1g1');

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/puertas'));
    expect(mockActualizar).toHaveBeenCalledWith('AA:BB', 'PLBT', 'classic', '2S0BP1G1', 'Ana');
  });

  it('con el locker y el PIN correcto empareja, guarda el dispositivo y entra en puertas', async () => {
    const pantalla = await abrirModalDe('PLBT');
    await vincular(pantalla, '2415');

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/puertas'));
    expect(mockBluetooth.vincularDispositivo).toHaveBeenCalledWith('AA:BB');
    expect(mockActualizar).toHaveBeenCalledWith('AA:BB', 'PLBT', 'classic', '2415', 'Ana');
  });
});
