import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { useBluetooth, BluetoothService } from '../../src/services/BluetoothService';
import AjustesScreen, { AppInfoCard } from '../../src/app/ajustes';
import { mostrarModal } from '../../src/components/Modal';

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
    Easing: {
      out: jest.fn((fn) => fn),
      inOut: jest.fn((fn) => fn),
      cubic: jest.fn(),
      quad: jest.fn(),
      back: jest.fn(() => jest.fn()),
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

jest.mock('../../src/services/StorageService', () => ({
  LogService: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../src/components/Modal', () => ({ mostrarModal: jest.fn() }));
jest.mock('../../src/components/Aparece', () => ({
  Aparece: (props: any) => require('react').createElement('View', props, props.children),
}));
jest.mock('../../src/components/Cargando', () => ({
  Cargando: () => require('react').createElement('Cargando'),
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    SafeAreaView: (props: any) => React.createElement('SafeAreaView', props, props.children),
  };
});

jest.mock('../../src/services/BluetoothService', () => ({
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

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn().mockReturnValue(false),
  },
}));

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

  it('al pulsar desconectar del locker, solo desconecta (sin abrir los ajustes del sistema)', async () => {
    const { getByTestId } = await render(<AjustesScreen />);

    const btnToggle = getByTestId('btn-toggle-conexion');
    expect(btnToggle).toBeTruthy();

    await act(async () => {
      fireEvent.press(btnToggle);
    });

    expect(mockDesconectar).toHaveBeenCalled();
    expect(BluetoothService.abrirAjustesBluetooth).not.toHaveBeenCalled();
  });

  it('al pulsar desvincular dispositivo, debe solicitar confirmación en un modal', async () => {
    const { getByTestId } = await render(<AjustesScreen />);

    const btnDesvincular = getByTestId('btn-desvincular');
    expect(btnDesvincular).toBeTruthy();

    await act(async () => {
      fireEvent.press(btnDesvincular);
    });

    expect(mostrarModal).toHaveBeenCalledWith(
      'Desvincular dispositivo',
      expect.stringContaining('Se borrarán los datos del dispositivo'),
      expect.any(Array)
    );
  });

  it('al confirmar desvincular, debe desconectar, desvincular del SO, purgar datos y volver a /buscar', async () => {
    const { getByTestId } = await render(<AjustesScreen />);

    const btnDesvincular = getByTestId('btn-desvincular');
    await act(async () => {
      fireEvent.press(btnDesvincular);
    });

    const alertCall = (mostrarModal as jest.Mock).mock.calls[0];
    const buttons = alertCall[2];
    const confirmButton = buttons.find((b: any) => b.text === 'Desvincular');

    expect(confirmButton).toBeDefined();

    await act(async () => {
      await confirmButton.onPress();
    });

    expect(mockDesconectar).toHaveBeenCalled();
    expect(BluetoothService.desvincularDispositivo).toHaveBeenCalledWith('AA:BB:CC:DD:EE:FF');
    expect(mockDesvincularDispositivo).toHaveBeenCalled();
    expect(require('expo-router').router.replace).toHaveBeenCalledWith('/buscar');
  });

  it('al pulsar el botón volver, debe llamar a router.back o router.replace', async () => {
    const { router } = require('expo-router');
    const { getByTestId } = await render(<AjustesScreen />);

    const btnVolver = getByTestId('btn-volver-ajustes');
    expect(btnVolver).toBeTruthy();

    await act(async () => {
      fireEvent.press(btnVolver);
    });

    expect(router.replace).toHaveBeenCalledWith('/puertas');
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
    expect(mostrarModal).not.toHaveBeenCalledWith('Conectado', expect.anything());
  });

  it('sin dispositivo vinculado ofrece buscarlo', async () => {
    (useBluetooth as jest.Mock).mockReturnValue({ deviceName: null, deviceMac: null, status: 'unpaired' });
    const { router } = require('expo-router');
    const { getByText, getByTestId, queryByTestId } = await render(<AjustesScreen />);

    expect(getByText('Sin dispositivo vinculado')).toBeTruthy();
    expect(queryByTestId('btn-desvincular')).toBeNull();
    await act(async () => {
      fireEvent.press(getByTestId('btn-buscar-locker'));
    });
    expect(router.replace).toHaveBeenCalledWith('/buscar');
  });

  it('debe renderizar la versión de package.json en AppInfoCard', async () => {
    const { getByText } = await render(<AppInfoCard />);
    expect(getByText(`Pocket Locker v${require('../../package.json').version}`)).toBeTruthy();
  });
});
