import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import NombreScreen from '../../src/app/nombre';
import { useBluetooth } from '../../src/services/BluetoothService';

jest.mock('../../src/services/BluetoothService', () => ({ __esModule: true, useBluetooth: jest.fn() }));
jest.mock('../../src/services/StorageService', () => ({
  LogService: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

describe('NombreScreen', () => {
  const guardarNombreUsuario = jest.fn().mockResolvedValue(undefined);
  const estado = (deviceMac: string | null) =>
    (useBluetooth as jest.Mock).mockReturnValue({ deviceMac, guardarNombreUsuario });

  beforeEach(() => {
    jest.clearAllMocks();
    estado(null);
  });

  it('pide el nombre con el título y la ayuda', async () => {
    const { getByText, getByTestId } = await render(<NombreScreen />);
    expect(getByText('¿Cómo te llamas?')).toBeTruthy();
    expect(getByText('Introduce tu nombre o apodo para identificarte en tu Pocket Locker.')).toBeTruthy();
    expect(getByTestId('input-nombre-usuario')).toBeTruthy();
    expect(getByTestId('btn-continuar-nombre')).toBeTruthy();
  });

  it('sin nombre muestra el error bajo el campo (sin modales) y no guarda nada', async () => {
    const { getByTestId } = await render(<NombreScreen />);
    await act(async () => {
      fireEvent.press(getByTestId('btn-continuar-nombre'));
    });
    expect(getByTestId('error-nombre-usuario')).toBeTruthy();
    expect(guardarNombreUsuario).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('el error desaparece al escribir', async () => {
    const { getByTestId, queryByTestId } = await render(<NombreScreen />);
    await act(async () => {
      fireEvent.press(getByTestId('btn-continuar-nombre'));
    });
    await act(async () => {
      fireEvent.changeText(getByTestId('input-nombre-usuario'), 'A');
    });
    expect(queryByTestId('error-nombre-usuario')).toBeNull();
  });

  it('guarda el nombre sin espacios y va a la búsqueda si no hay dispositivo', async () => {
    const { getByTestId } = await render(<NombreScreen />);
    await act(async () => {
      fireEvent.changeText(getByTestId('input-nombre-usuario'), '  Ana  ');
    });
    await act(async () => {
      fireEvent.press(getByTestId('btn-continuar-nombre'));
    });
    expect(guardarNombreUsuario).toHaveBeenCalledWith('Ana');
    expect(router.replace).toHaveBeenCalledWith('/buscar');
  });

  it('con dispositivo vinculado va a las puertas', async () => {
    estado('AA:BB');
    const { getByTestId } = await render(<NombreScreen />);
    await act(async () => {
      fireEvent.changeText(getByTestId('input-nombre-usuario'), 'Ana');
    });
    await act(async () => {
      fireEvent.press(getByTestId('btn-continuar-nombre'));
    });
    expect(router.replace).toHaveBeenCalledWith('/puertas');
  });
});
