import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { useBluetooth } from '../../context/BluetoothContext';
import ControlScreen from '../control';

// Mock de react-native con elementos de host estándar
jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: (props: any) => React.createElement('View', props, props.children),
    Text: (props: any) => React.createElement('Text', props, props.children),
    TouchableOpacity: (props: any) => {
      const onPress = props.onPress;
      return React.createElement(
        'TouchableOpacity',
        {
          ...props,
          onPress: props.disabled ? undefined : onPress,
        },
        props.children
      );
    },
    ScrollView: (props: any) => React.createElement('ScrollView', props, props.children),
    ActivityIndicator: (props: any) => React.createElement('ActivityIndicator', props),
    Animated: {
      Value: jest.fn().mockImplementation(() => ({
        setValue: jest.fn(),
        interpolate: jest.fn().mockReturnValue(0),
      })),
      timing: jest.fn().mockImplementation(() => ({
        start: jest.fn(),
      })),
      sequence: jest.fn(),
      loop: jest.fn().mockImplementation(() => ({
        start: jest.fn(),
        stop: jest.fn(),
      })),
      View: (props: any) => React.createElement('View', props, props.children),
    },
    StyleSheet: {
      create: (styles: any) => styles,
      flatten: (styles: any) => Array.isArray(styles) ? Object.assign({}, ...styles) : styles || {},
    },
    Platform: {
      OS: 'ios',
    },
    Alert: {
      alert: jest.fn(),
    },
  };
});

// Mock de react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    SafeAreaView: (props: any) => React.createElement('SafeAreaView', props, props.children),
  };
});

// Mock de expo-haptics
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: {
    Success: 'success',
    Error: 'error',
    Warning: 'warning',
  },
}));

// Mock de useBluetooth
jest.mock('../../context/BluetoothContext', () => ({
  useBluetooth: jest.fn(),
}));

// Mock de react-native-bluetooth-classic
jest.mock('react-native-bluetooth-classic', () => ({
  __esModule: true,
  default: {
    onBluetoothEnabled: jest.fn().mockReturnValue({ remove: jest.fn() }),
    onBluetoothDisabled: jest.fn().mockReturnValue({ remove: jest.fn() }),
  },
}));

// Mock de expo-router
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

// Mock de @expo/vector-icons
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    MaterialIcons: (props: any) => React.createElement('Text', null, props.name),
  };
});

describe('Unified ControlScreen', () => {
  const mockConectar = jest.fn();
  const mockEnviarComando = jest.fn();
  const mockSetModoSimulacion = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useBluetooth as jest.Mock).mockReturnValue({
      status: 'connected',
      deviceName: 'Locker Test',
      deviceMac: '00:11:22:33:44:55',
      conectar: mockConectar,
      enviarComando: mockEnviarComando,
      modoSimulacion: false,
      setModoSimulacion: mockSetModoSimulacion,
    });
  });

  it('debería renderizar correctamente el título y estado conectado', async () => {
    const { getByText } = await render(<ControlScreen />);

    expect(getByText('Panel de Control')).toBeTruthy();
    expect(getByText('Locker Test')).toBeTruthy();
    expect(getByText('Puerta Peatonal')).toBeTruthy();
    expect(getByText('Portón de Garaje')).toBeTruthy();
  });

  it('debería enviar el comando E al presionar el botón de puerta peatonal', async () => {
    const { getByTestId } = await render(<ControlScreen />);

    const button = getByTestId('btn-peatonal');
    expect(button).toBeTruthy();

    await act(async () => {
      fireEvent.press(button);
    });

    expect(mockEnviarComando).toHaveBeenCalledWith('E');
  });

  it('debería enviar el comando H al presionar el botón de portón de garaje', async () => {
    const { getByTestId } = await render(<ControlScreen />);

    const button = getByTestId('btn-garaje');
    expect(button).toBeTruthy();

    await act(async () => {
      fireEvent.press(button);
    });

    expect(mockEnviarComando).toHaveBeenCalledWith('H');
  });

  it('debería intentar conectar primero si está desconectado al presionar peatonal', async () => {
    (useBluetooth as jest.Mock).mockReturnValue({
      status: 'disconnected',
      deviceName: 'Locker Test',
      deviceMac: '00:11:22:33:44:55',
      conectar: mockConectar,
      enviarComando: mockEnviarComando,
      modoSimulacion: false,
      setModoSimulacion: mockSetModoSimulacion,
    });

    const { getByTestId } = await render(<ControlScreen />);

    const button = getByTestId('btn-peatonal');
    await act(async () => {
      fireEvent.press(button);
    });

    expect(mockConectar).toHaveBeenCalled();
    expect(mockEnviarComando).toHaveBeenCalledWith('E');
  });

  it('debería alternar el modo simulación al presionar el botón correspondiente', async () => {
    const { getByTestId } = await render(<ControlScreen />);

    const toggle = getByTestId('simulacion-toggle');
    expect(toggle).toBeTruthy();

    await act(async () => {
      fireEvent.press(toggle);
    });

    expect(mockSetModoSimulacion).toHaveBeenCalledWith(true);
  });
});
