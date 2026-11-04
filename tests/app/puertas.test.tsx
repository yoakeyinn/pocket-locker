import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { useBluetooth } from '../../src/services/BluetoothService';
import PuertasScreen from '../../src/app/puertas';

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
      delay: jest.fn().mockImplementation(() => ({
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
    Easing: {
      out: jest.fn((fn) => fn),
      ease: jest.fn(),
      quad: jest.fn(),
      cubic: jest.fn(),
      back: jest.fn(() => jest.fn()),
      linear: jest.fn(),
      in: jest.fn((fn) => fn),
      inOut: jest.fn((fn) => fn),
    },
    StyleSheet: {
      create: (styles: any) => styles,
      flatten: (styles: any) => (Array.isArray(styles) ? Object.assign({}, ...styles) : styles || {}),
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
    AppState: {
      addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
      currentState: 'active',
    },
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    SafeAreaView: (props: any) => React.createElement('SafeAreaView', props, props.children),
  };
});

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: {
    Success: 'success',
    Error: 'error',
    Warning: 'warning',
  },
}));

jest.mock('../../src/services/BluetoothService', () => ({
  __esModule: true,
  useBluetooth: jest.fn(),
  BluetoothService: {},
  default: {},
}));

jest.mock('react-native-bluetooth-classic', () => ({
  __esModule: true,
  default: {
    onBluetoothEnabled: jest.fn().mockReturnValue({ remove: jest.fn() }),
    onBluetoothDisabled: jest.fn().mockReturnValue({ remove: jest.fn() }),
  },
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    MaterialIcons: (props: any) => React.createElement('Text', null, props.name),
    FontAwesome5: (props: any) => React.createElement('Text', null, props.name),
    FontAwesome6: (props: any) => React.createElement('Text', null, props.name),
  };
});

jest.mock('../../src/services/StorageService', () => ({
  __esModule: true,
  default: {
    getUltimaPuerta: jest.fn().mockResolvedValue('peatonal'),
    saveUltimaPuerta: jest.fn().mockResolvedValue(undefined),
  },
  StorageService: {
    getUltimaPuerta: jest.fn().mockResolvedValue('peatonal'),
    saveUltimaPuerta: jest.fn().mockResolvedValue(undefined),
  },
  LogService: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Unified PuertasScreen (Minimalist Infinite Scroll)', () => {
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
    });
  });

  it('debería renderizar correctamente el título y estado conectado', async () => {
    const { getByText, getAllByText } = await render(<PuertasScreen />);

    expect(getByText('Panel de Control')).toBeTruthy();
    expect(getByText('Locker Test')).toBeTruthy();
    expect(getAllByText('Puerta Peatonal').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Portón de Garaje')).toBeTruthy();
  });

  it('debería enviar el comando P al presionar el botón de puerta peatonal', async () => {
    const { getByTestId } = await render(<PuertasScreen />);

    const button = getByTestId('btn-peatonal');
    expect(button).toBeTruthy();

    await act(async () => {
      fireEvent.press(button);
    });

    expect(mockEnviarComando).toHaveBeenCalledWith('P');
    expect(mockIniciarBloqueoMargen).toHaveBeenCalledWith(5);
  });

  it('debería alternar entre accesos al pulsar las pestañas del selector', async () => {
    const { getByTestId, queryByTestId } = await render(<PuertasScreen />);

    expect(getByTestId('btn-peatonal')).toBeTruthy();
    expect(queryByTestId('btn-garaje')).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId('tab-garaje'));
    });

    expect(queryByTestId('btn-peatonal')).toBeNull();
    expect(getByTestId('btn-garaje')).toBeTruthy();
  });

  it('debería enviar el comando G al presionar el botón de portón de garaje', async () => {
    const { getByTestId } = await render(<PuertasScreen />);

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
      desconectar: mockDesconectar,
      enviarComando: mockEnviarComando,
      tiempoRestanteBloqueo: 0,
      iniciarBloqueoMargen: mockIniciarBloqueoMargen,
      ultimaPuerta: 'peatonal',
      guardarUltimaPuerta: mockGuardarUltimaPuerta,
    });

    const { getByTestId } = await render(<PuertasScreen />);

    const button = getByTestId('btn-peatonal');
    await act(async () => {
      fireEvent.press(button);
    });

    expect(mockConectar).toHaveBeenCalled();
    expect(mockEnviarComando).toHaveBeenCalledWith('P');
  });

  it('debería deshabilitar los botones cuando hay margen de exclusión mutua activo (5s)', async () => {
    (useBluetooth as jest.Mock).mockReturnValue({
      status: 'connected',
      deviceName: 'Locker Test',
      deviceMac: '00:11:22:33:44:55',
      conectar: mockConectar,
      desconectar: mockDesconectar,
      enviarComando: mockEnviarComando,
      tiempoRestanteBloqueo: 5,
      iniciarBloqueoMargen: mockIniciarBloqueoMargen,
      ultimaPuerta: 'peatonal',
      guardarUltimaPuerta: mockGuardarUltimaPuerta,
    });

    const { getByTestId, getByText } = await render(<PuertasScreen />);

    const btnPeatonal = getByTestId('btn-peatonal');
    expect(btnPeatonal.props.onPress).toBeUndefined();
    expect(getByText('Espera 5 s...')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('tab-garaje'));
    });

    const btnGaraje = getByTestId('btn-garaje');
    expect(btnGaraje.props.onPress).toBeUndefined();
  });

  it('debería iniciar por defecto en garaje si ultimaPuerta es garaje', async () => {
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
    });

    const { getByTestId, queryByTestId } = await render(<PuertasScreen />);

    expect(getByTestId('btn-garaje')).toBeTruthy();
    expect(queryByTestId('btn-peatonal')).toBeNull();
  });

  it('debería alternar a garaje y persistir ultimaPuerta al deslizar a la izquierda (swipe left)', async () => {
    const { PanResponder } = require('react-native');
    const { getByTestId, queryByTestId } = await render(<PuertasScreen />);

    expect(getByTestId('btn-peatonal')).toBeTruthy();
    expect(queryByTestId('btn-garaje')).toBeNull();

    const lastCall = (PanResponder.create as jest.Mock).mock.results.slice(-1)[0];
    const config = lastCall.value._config;

    expect(config.onMoveShouldSetPanResponder({}, { dx: -30, dy: 5 })).toBe(true);
    expect(config.onMoveShouldSetPanResponder({}, { dx: 5, dy: 30 })).toBe(false);

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
    });

    const { getByTestId, queryByTestId } = await render(<PuertasScreen />);

    expect(getByTestId('btn-garaje')).toBeTruthy();
    expect(queryByTestId('btn-peatonal')).toBeNull();

    const lastCall = (PanResponder.create as jest.Mock).mock.results.slice(-1)[0];
    const config = lastCall.value._config;

    await act(async () => {
      config.onPanResponderRelease({}, { dx: 60, vx: 0.5 });
    });

    expect(queryByTestId('btn-garaje')).toBeNull();
    expect(getByTestId('btn-peatonal')).toBeTruthy();
    expect(mockGuardarUltimaPuerta).toHaveBeenCalledWith('peatonal');
  });

  it('debería mostrar banner de confirmación en pantalla y no navegar a resultado al abrir', async () => {
    const { router } = require('expo-router');
    const { getByTestId, getByText } = await render(<PuertasScreen />);

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
    const { unmount } = await render(<PuertasScreen />);
    await act(async () => {
      unmount();
    });
    expect(mockDesconectar).toHaveBeenCalled();
  });

  it('debería navegar a ajustes al presionar el botón de ajustes de la cabecera', async () => {
    const { router } = require('expo-router');
    const { getByTestId } = await render(<PuertasScreen />);

    const btnAjustes = getByTestId('btn-header-ajustes');
    expect(btnAjustes).toBeTruthy();

    await act(async () => {
      fireEvent.press(btnAjustes);
    });

    expect(router.push).toHaveBeenCalledWith('/ajustes');
  });

  it('saluda al usuario en la cabecera', async () => {
    (useBluetooth as jest.Mock).mockReturnValue({ ...(useBluetooth as jest.Mock)(), userName: 'Ana' });
    const { getByText } = await render(<PuertasScreen />);
    expect(getByText('Hola, Ana')).toBeTruthy();
  });

  it('sin dispositivo vinculado muestra el estado vacío y no los controles', async () => {
    const { router } = require('expo-router');
    (useBluetooth as jest.Mock).mockReturnValue({
      status: 'unpaired',
      deviceName: null,
      deviceMac: null,
      conectar: mockConectar,
      desconectar: mockDesconectar,
      enviarComando: mockEnviarComando,
      tiempoRestanteBloqueo: 0,
      iniciarBloqueoMargen: mockIniciarBloqueoMargen,
      ultimaPuerta: 'peatonal',
      guardarUltimaPuerta: mockGuardarUltimaPuerta,
    });

    const { getByText, getByTestId, queryByTestId } = await render(<PuertasScreen />);

    expect(getByText('Sin dispositivo vinculado')).toBeTruthy();
    expect(queryByTestId('btn-peatonal')).toBeNull();
    await act(async () => {
      fireEvent.press(getByTestId('btn-buscar-locker'));
    });
    expect(router.replace).toHaveBeenCalledWith('/buscar');
  });

  it('no debería contener la palabra "Abrir" dentro del botón, manteniendo "Pulsar para abrir" debajo', async () => {
    const { getByText, queryByText } = await render(<PuertasScreen />);

    expect(getByText('Pulsar para abrir')).toBeTruthy();
    expect(queryByText('Abrir')).toBeNull();
  });
});
