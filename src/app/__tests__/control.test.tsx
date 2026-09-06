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
        start: jest.fn((cb) => cb && cb({ finished: true })),
      })),
      spring: jest.fn().mockImplementation(() => ({
        start: jest.fn((cb) => cb && cb({ finished: true })),
      })),
      sequence: jest.fn().mockImplementation(() => ({
        start: jest.fn((cb) => cb && cb({ finished: true })),
        stop: jest.fn(),
      })),
      parallel: jest.fn().mockImplementation(() => ({
        start: jest.fn((cb) => cb && cb({ finished: true })),
        stop: jest.fn(),
      })),
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
    Dimensions: {
      get: jest.fn().mockReturnValue({ width: 375, height: 812 }),
    },
    PanResponder: {
      create: jest.fn().mockImplementation((config) => ({
        panHandlers: {},
        _config: config,
      })),
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
  const mockDesconectar = jest.fn().mockResolvedValue(undefined);
  const mockEnviarComando = jest.fn();
  const mockIniciarBloqueoMargen = jest.fn();
  const mockGuardarUltimaPuerta = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    (useBluetooth as jest.Mock).mockReturnValue({
      status: 'connected',
      deviceName: 'Locker Test',
      deviceMac: '00:11:22:33:44:55',
      conectar: mockConectar,
      desconectar: mockDesconectar,
      enviarComando: mockEnviarComando,
      tiempoRestanteBloqueo: 0,
      iniciarBloqueoMargen: mockIniciarBloqueoMargen,
      ultimaPuerta: 'peatonal',
      guardarUltimaPuerta: mockGuardarUltimaPuerta,
      userRole: 'admin',
      permisos: { peatonal: true, garaje: true },
      diasRestantes: null,
      estaBloqueado: false,
    });
  });

  it('debería renderizar correctamente el título y estado conectado', async () => {
    const { getByText, getAllByText } = await render(<ControlScreen />);

    expect(getByText('Panel de Control')).toBeTruthy();
    expect(getByText('Locker Test')).toBeTruthy();
    expect(getAllByText('Puerta Peatonal').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Portón de Garaje')).toBeTruthy();
  });

  it('debería enviar el comando P al presionar el botón de puerta peatonal', async () => {
    const { getByTestId } = await render(<ControlScreen />);

    const button = getByTestId('btn-peatonal');
    expect(button).toBeTruthy();

    await act(async () => {
      fireEvent.press(button);
    });

    expect(mockEnviarComando).toHaveBeenCalledWith('P');
    expect(mockIniciarBloqueoMargen).toHaveBeenCalledWith(5);
  });

  it('debería alternar entre pantallas/pestañas de peatonal y garaje', async () => {
    const { getByTestId, queryByTestId } = await render(<ControlScreen />);

    expect(getByTestId('btn-peatonal')).toBeTruthy();
    expect(queryByTestId('btn-garaje')).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId('tab-garaje'));
    });

    expect(queryByTestId('btn-peatonal')).toBeNull();
    expect(getByTestId('btn-garaje')).toBeTruthy();
  });

  it('debería enviar el comando G al presionar el botón de portón de garaje', async () => {
    const { getByTestId } = await render(<ControlScreen />);

    await act(async () => {
      fireEvent.press(getByTestId('tab-garaje'));
    });

    const button = getByTestId('btn-garaje');
    expect(button).toBeTruthy();

    await act(async () => {
      fireEvent.press(button);
    });

    expect(mockEnviarComando).toHaveBeenCalledWith('G');
    expect(mockIniciarBloqueoMargen).toHaveBeenCalledWith(5);
  });

  it('debería intentar conectar primero si está desconectado al presionar peatonal', async () => {
    (useBluetooth as jest.Mock).mockReturnValue({
      status: 'disconnected',
      deviceName: 'Locker Test',
      deviceMac: '00:11:22:33:44:55',
      conectar: mockConectar,
      enviarComando: mockEnviarComando,
      tiempoRestanteBloqueo: 0,
      iniciarBloqueoMargen: mockIniciarBloqueoMargen,
      userRole: 'admin',
      permisos: { peatonal: true, garaje: true },
      diasRestantes: null,
      estaBloqueado: false,
    });

    const { getByTestId } = await render(<ControlScreen />);

    const button = getByTestId('btn-peatonal');
    await act(async () => {
      fireEvent.press(button);
    });

    expect(mockConectar).toHaveBeenCalled();
    expect(mockEnviarComando).toHaveBeenCalledWith('P');
  });

  it('debería deshabilitar los botones cuando hay margen de tiempo activo', async () => {
    (useBluetooth as jest.Mock).mockReturnValue({
      status: 'connected',
      deviceName: 'Locker Test',
      deviceMac: '00:11:22:33:44:55',
      conectar: mockConectar,
      enviarComando: mockEnviarComando,
      tiempoRestanteBloqueo: 5,
      iniciarBloqueoMargen: mockIniciarBloqueoMargen,
    });

    const { getByTestId, getByText } = await render(<ControlScreen />);

    const btnPeatonal = getByTestId('btn-peatonal');
    expect(btnPeatonal.props.onPress).toBeUndefined();
    expect(getByText('Espera 5 s...')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('tab-garaje'));
    });

    const btnGaraje = getByTestId('btn-garaje');
    expect(btnGaraje.props.onPress).toBeUndefined();
  });

  it('debería iniciar por defecto en la pestaña de garaje si ultimaPuerta es garaje', async () => {
    (useBluetooth as jest.Mock).mockReturnValue({
      status: 'connected',
      deviceName: 'Locker Test',
      deviceMac: '00:11:22:33:44:55',
      conectar: mockConectar,
      enviarComando: mockEnviarComando,
      tiempoRestanteBloqueo: 0,
      iniciarBloqueoMargen: mockIniciarBloqueoMargen,
      ultimaPuerta: 'garaje',
      guardarUltimaPuerta: mockGuardarUltimaPuerta,
    });

    const { getByTestId, queryByTestId } = await render(<ControlScreen />);

    expect(getByTestId('btn-garaje')).toBeTruthy();
    expect(queryByTestId('btn-peatonal')).toBeNull();
  });

  it('debería guardar la última puerta al alternar pestañas', async () => {
    const { getByTestId } = await render(<ControlScreen />);

    await act(async () => {
      fireEvent.press(getByTestId('tab-garaje'));
    });

    expect(mockGuardarUltimaPuerta).toHaveBeenCalledWith('garaje');
  });

  it('debería alternar a garaje y persistir ultimaPuerta al deslizar a la izquierda (swipe left)', async () => {
    const { PanResponder } = require('react-native');
    const { getByTestId, queryByTestId } = await render(<ControlScreen />);

    expect(getByTestId('btn-peatonal')).toBeTruthy();
    expect(queryByTestId('btn-garaje')).toBeNull();

    // Obtener la configuración del PanResponder instanciado
    const lastCall = (PanResponder.create as jest.Mock).mock.results.slice(-1)[0];
    const config = lastCall.value._config;

    // Verificar que el gesto horizontal se captura y el vertical se ignora
    expect(config.onMoveShouldSetPanResponder({}, { dx: -30, dy: 5 })).toBe(true);
    expect(config.onMoveShouldSetPanResponder({}, { dx: 5, dy: 30 })).toBe(false);

    // Simular lanzamiento de swipe hacia la izquierda
    await act(async () => {
      config.onPanResponderRelease({}, { dx: -60, vx: -0.5 });
    });

    expect(queryByTestId('btn-peatonal')).toBeNull();
    expect(getByTestId('btn-garaje')).toBeTruthy();
    expect(mockGuardarUltimaPuerta).toHaveBeenCalledWith('garaje');
  });

  it('debería permitir scroll infinito bidireccional al deslizar hacia la derecha (swipe right)', async () => {
    const { PanResponder } = require('react-native');
    (useBluetooth as jest.Mock).mockReturnValue({
      status: 'connected',
      deviceName: 'Locker Test',
      deviceMac: '00:11:22:33:44:55',
      conectar: mockConectar,
      desconectar: mockDesconectar,
      enviarComando: mockEnviarComando,
      tiempoRestanteBloqueo: 0,
      iniciarBloqueoMargen: mockIniciarBloqueoMargen,
      ultimaPuerta: 'garaje',
      guardarUltimaPuerta: mockGuardarUltimaPuerta,
      userRole: 'admin',
      permisos: { peatonal: true, garaje: true },
    });

    const { getByTestId, queryByTestId } = await render(<ControlScreen />);

    expect(getByTestId('btn-garaje')).toBeTruthy();
    expect(queryByTestId('btn-peatonal')).toBeNull();

    const lastCall = (PanResponder.create as jest.Mock).mock.results.slice(-1)[0];
    const config = lastCall.value._config;

    // Simular swipe hacia la derecha desde garaje -> vuelve a peatonal en bucle infinito
    await act(async () => {
      config.onPanResponderRelease({}, { dx: 60, vx: 0.5 });
    });

    expect(queryByTestId('btn-garaje')).toBeNull();
    expect(getByTestId('btn-peatonal')).toBeTruthy();
    expect(mockGuardarUltimaPuerta).toHaveBeenCalledWith('peatonal');
  });

  it('debería mostrar banner de confirmación en pantalla y no navegar a resultado al abrir', async () => {
    const { router } = require('expo-router');
    const { getByTestId, getByText } = await render(<ControlScreen />);

    const button = getByTestId('btn-peatonal');
    await act(async () => {
      fireEvent.press(button);
    });

    expect(mockEnviarComando).toHaveBeenCalledWith('P');
    expect(mockIniciarBloqueoMargen).toHaveBeenCalledWith(5);
    expect(getByTestId('banner-exito-apertura')).toBeTruthy();
    expect(getByText('¡Puerta peatonal abriéndose!')).toBeTruthy();
    expect(router.push).not.toHaveBeenCalledWith(expect.stringContaining('resultado'));
  });

  it('debería desconectar al desmontar la pantalla para no bloquear el locker', async () => {
    const { unmount } = await render(<ControlScreen />);
    await act(async () => {
      unmount();
    });
    expect(mockDesconectar).toHaveBeenCalled();
  });
});
