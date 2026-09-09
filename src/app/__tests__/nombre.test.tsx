import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import NombreScreen from '../nombre';
import { useBluetooth } from '../../services/BluetoothService';

// Mock de react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    SafeAreaView: (props: any) => React.createElement('SafeAreaView', props, props.children),
  };
});

// Mock de BluetoothService y useBluetooth
jest.mock('../../services/BluetoothService', () => ({
  __esModule: true,
  useBluetooth: jest.fn(),
  BluetoothService: {},
  default: {},
}));

// Mock de expo-router
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  },
}));

// Mock de @expo/vector-icons
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    MaterialIcons: (props: any) => React.createElement('Text', null, props.name),
  };
});

describe('NombreScreen (Registro de Nombre de Usuario)', () => {
  const mockGuardarNombreUsuario = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (useBluetooth as jest.Mock).mockReturnValue({
      userName: null,
      deviceMac: null,
      guardarNombreUsuario: mockGuardarNombreUsuario,
    });
  });

  it('debería renderizar el formulario solicitando el nombre', async () => {
    const { getByText, getByTestId } = await render(<NombreScreen />);

    expect(getByText('¿Cómo te llamas?')).toBeTruthy();
    expect(getByTestId('input-nombre-usuario')).toBeTruthy();
    expect(getByTestId('btn-continuar-nombre')).toBeTruthy();
  });

  it('debería alertar si se intenta continuar con el nombre vacío', async () => {
    const { getByTestId } = await render(<NombreScreen />);

    const btn = getByTestId('btn-continuar-nombre');
    await act(async () => {
      fireEvent.press(btn);
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Nombre requerido',
      expect.stringContaining('introduce tu nombre')
    );
    expect(mockGuardarNombreUsuario).not.toHaveBeenCalled();
  });

  it('debería guardar el nombre y navegar a /inicio si no hay dispositivo vinculado', async () => {
    const { getByTestId } = await render(<NombreScreen />);

    const input = getByTestId('input-nombre-usuario');
    const btn = getByTestId('btn-continuar-nombre');

    await act(async () => {
      fireEvent.changeText(input, 'Alba');
    });

    await act(async () => {
      fireEvent.press(btn);
    });

    expect(mockGuardarNombreUsuario).toHaveBeenCalledWith('Alba');
    expect(router.replace).toHaveBeenCalledWith('/inicio');
  });

  it('debería guardar el nombre y navegar a /control si ya hay dispositivo vinculado', async () => {
    (useBluetooth as jest.Mock).mockReturnValue({
      userName: null,
      deviceMac: 'AA:BB:CC:DD:EE:FF',
      guardarNombreUsuario: mockGuardarNombreUsuario,
    });

    const { getByTestId } = await render(<NombreScreen />);

    const input = getByTestId('input-nombre-usuario');
    const btn = getByTestId('btn-continuar-nombre');

    await act(async () => {
      fireEvent.changeText(input, 'Alba');
    });

    await act(async () => {
      fireEvent.press(btn);
    });

    expect(mockGuardarNombreUsuario).toHaveBeenCalledWith('Alba');
    expect(router.replace).toHaveBeenCalledWith('/control');
  });
});
