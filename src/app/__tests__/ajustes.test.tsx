import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { useBluetooth, BluetoothService } from '../../services/BluetoothService';
import AjustesScreen, { AppInfoCard } from '../ajustes';
import { BackHandler, Alert } from 'react-native';

// Mock de react-native
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
    TextInput: (props: any) => React.createElement('TextInput', props),
    ActivityIndicator: (props: any) => React.createElement('ActivityIndicator', props),
    BackHandler: {
      exitApp: jest.fn(),
    },
    Alert: {
      alert: jest.fn(),
    },
    StyleSheet: {
      create: (styles: any) => styles,
      flatten: (styles: any) => Array.isArray(styles) ? Object.assign({}, ...styles) : styles || {},
    },
    Platform: {
      OS: 'android',
    },
  };
});

// Mock de StorageService y BiometricService
jest.mock('../../services/StorageService', () => ({
  __esModule: true,
  default: {
    saveDeviceName: jest.fn().mockResolvedValue(undefined),
    getAppLockConfig: jest.fn().mockResolvedValue({ enabled: false, mode: 'pin', pin: '' }),
    saveAppLockConfig: jest.fn().mockResolvedValue(undefined),
    getAppCustomPreferences: jest.fn().mockResolvedValue({
      appName: 'Pocket Locker',
      appIcon: 'clasico',
      themeMode: 'light',
      themeColor: 'azul',
    }),
    saveAppCustomPreferences: jest.fn().mockResolvedValue(undefined),
  },
  StorageService: {
    saveDeviceName: jest.fn().mockResolvedValue(undefined),
    getAppLockConfig: jest.fn().mockResolvedValue({ enabled: false, mode: 'pin', pin: '' }),
    saveAppLockConfig: jest.fn().mockResolvedValue(undefined),
    getAppCustomPreferences: jest.fn().mockResolvedValue({
      appName: 'Pocket Locker',
      appIcon: 'clasico',
      themeMode: 'light',
      themeColor: 'azul',
    }),
    saveAppCustomPreferences: jest.fn().mockResolvedValue(undefined),
  },
  BiometricService: {
    soportaBiometria: jest.fn().mockResolvedValue(true),
    tieneBiometriaRegistrada: jest.fn().mockResolvedValue(true),
    autenticarParaDesbloquearApp: jest.fn().mockResolvedValue({ exito: true }),
    autenticarParaEditarPin: jest.fn().mockResolvedValue({ exito: true }),
  },
}));

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
  BluetoothService: {
    abrirAjustesBluetooth: jest.fn().mockResolvedValue(undefined),
    desvincularDispositivo: jest.fn().mockResolvedValue(true),
  },
  default: {
    abrirAjustesBluetooth: jest.fn().mockResolvedValue(undefined),
    desvincularDispositivo: jest.fn().mockResolvedValue(true),
  },
}));

// Mock de expo-router
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn().mockReturnValue(false),
  },
}));

// Mock de @expo/vector-icons
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    MaterialIcons: (props: any) => React.createElement('Text', null, props.name),
  };
});

describe('AjustesScreen (Desconexión y Desvinculación)', () => {
  const mockConectar = jest.fn().mockResolvedValue(undefined);
  const mockDesconectar = jest.fn().mockResolvedValue(undefined);
  const mockDesvincularDispositivo = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    (useBluetooth as jest.Mock).mockReturnValue({
      deviceName: 'PLBT-Test',
      deviceMac: 'AA:BB:CC:DD:EE:FF',
      status: 'connected',
      conectar: mockConectar,
      desconectar: mockDesconectar,
      desvincularDispositivo: mockDesvincularDispositivo,
    });
  });

  it('al pulsar desconectar del locker, debe desconectar y abrir ajustes de Bluetooth del móvil', async () => {
    const { getByTestId } = await render(<AjustesScreen />);

    const btnToggle = getByTestId('btn-toggle-conexion');
    expect(btnToggle).toBeTruthy();

    await act(async () => {
      fireEvent.press(btnToggle);
    });

    expect(mockDesconectar).toHaveBeenCalled();
    expect(BluetoothService.abrirAjustesBluetooth).toHaveBeenCalled();
  });

  it('al pulsar desvincular dispositivo, debe solicitar confirmación en Alert', async () => {
    const { getByTestId } = await render(<AjustesScreen />);

    const btnDesvincular = getByTestId('btn-desvincular');
    expect(btnDesvincular).toBeTruthy();

    await act(async () => {
      fireEvent.press(btnDesvincular);
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Desvincular dispositivo',
      expect.stringContaining('Se borrarán los datos del dispositivo y la app se cerrará'),
      expect.any(Array)
    );
  });

  it('al confirmar desvincular, debe desconectar, desvincular del SO, purgar datos y llamar a BackHandler.exitApp', async () => {
    const { getByTestId } = await render(<AjustesScreen />);

    const btnDesvincular = getByTestId('btn-desvincular');
    await act(async () => {
      fireEvent.press(btnDesvincular);
    });

    // Simular pulsación de "Desvincular y Salir" en el Alert
    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const buttons = alertCall[2];
    const confirmButton = buttons.find((b: any) => b.text === 'Desvincular y Salir');

    expect(confirmButton).toBeDefined();

    await act(async () => {
      await confirmButton.onPress();
    });

    expect(mockDesconectar).toHaveBeenCalled();
    expect(BluetoothService.desvincularDispositivo).toHaveBeenCalledWith('AA:BB:CC:DD:EE:FF');
    expect(mockDesvincularDispositivo).toHaveBeenCalled();
    expect(BackHandler.exitApp).toHaveBeenCalled();
  });

  it('al pulsar el botón volver, debe llamar a router.back o router.replace', async () => {
    const { router } = require('expo-router');
    const { getByTestId } = await render(<AjustesScreen />);

    const btnVolver = getByTestId('btn-volver-ajustes');
    expect(btnVolver).toBeTruthy();

    await act(async () => {
      fireEvent.press(btnVolver);
    });

    expect(router.replace).toHaveBeenCalledWith('/control');
  });

  it('al pulsar conectar estando desconectado, debe intentar conectar sin mostrar falsas alertas de éxito', async () => {
    (useBluetooth as jest.Mock).mockReturnValue({
      deviceName: 'PLBT-Test',
      deviceMac: 'AA:BB:CC:DD:EE:FF',
      status: 'disconnected',
      conectar: mockConectar,
      desconectar: mockDesconectar,
      desvincularDispositivo: mockDesvincularDispositivo,
    });

    const { getByTestId } = await render(<AjustesScreen />);

    const btnToggle = getByTestId('btn-toggle-conexion');
    await act(async () => {
      fireEvent.press(btnToggle);
    });

    expect(mockConectar).toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalledWith('Conectado', expect.anything());
  });

  it('debe renderizar las secciones de Bloqueo de la App, Personalización y Temas', async () => {
    const { getByText } = await render(<AjustesScreen />);

    expect(getByText('Bloqueo de la App')).toBeTruthy();
    expect(getByText('Personalización de la App')).toBeTruthy();
    expect(getByText('Tema de la Aplicación')).toBeTruthy();
  });

  it('debe renderizar la versión oficial v1.4.1 en AppInfoCard', async () => {
    const { getByText } = await render(<AppInfoCard />);
    expect(getByText('Pocket Locker v1.4.1')).toBeTruthy();
  });

  it('al pulsar Cambiar PIN con bloqueo activo, debe solicitar autenticación biométrica', async () => {
    const StorageModule = require('../../services/StorageService');
    StorageModule.default.getAppLockConfig.mockResolvedValueOnce({ enabled: true, mode: 'pin', pin: '1234' });
    StorageModule.StorageService.getAppLockConfig.mockResolvedValueOnce({ enabled: true, mode: 'pin', pin: '1234' });

    const { findByText } = await render(<AjustesScreen />);
    const btnCambiarPin = await findByText('Cambiar PIN');
    expect(btnCambiarPin).toBeTruthy();

    await act(async () => {
      fireEvent.press(btnCambiarPin);
    });

    expect(StorageModule.BiometricService.autenticarParaEditarPin).toHaveBeenCalled();
  });
});
