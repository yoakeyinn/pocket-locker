import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { useBluetooth, BluetoothService } from '../../src/services/BluetoothService';
import AjustesScreen from '../../src/app/ajustes';
import { AppInfoCard } from '../../src/components/ajustes/AppInfoCard';
import { mostrarModal } from '../../src/components/Modal';
import { sincronizarSimulacion, useSimulacion } from '../../src/services/Simulacion';
import { borrarDatosApp } from '../../src/services/Reinicio';

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
jest.mock('../../src/components/Preferencias', () => ({ Preferencias: () => null }));
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

jest.mock('../../src/services/Simulacion', () => {
  const { create } = require('zustand');
  return {
    useSimulacion: create(() => ({ activa: false })),
    sincronizarSimulacion: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock('../../src/services/Reinicio', () => ({ borrarDatosApp: jest.fn().mockResolvedValue(undefined) }));

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
  const mockGuardarNombre = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    (useBluetooth as jest.Mock).mockReturnValue({
      deviceName: 'PLBT-Test',
      deviceMac: 'AA:BB:CC:DD:EE:FF',
      status: 'connected',
      conectar: mockConectar,
      desconectar: mockDesconectar,
      desvincularDispositivo: mockDesvincularDispositivo,
      userName: 'Ana',
      guardarNombreUsuario: mockGuardarNombre,
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

  describe('nombre de usuario y modo demo', () => {
    const editar = async (pantalla: Awaited<ReturnType<typeof render>>, nombre: string) => {
      await act(async () => {
        fireEvent.press(pantalla.getByTestId('btn-editar-usuario'));
      });
      await act(async () => {
        fireEvent.changeText(pantalla.getByTestId('editor-texto'), nombre);
      });
    };

    it('muestra el nombre actual', async () => {
      const { getByTestId } = await render(<AjustesScreen />);
      expect(getByTestId('nombre-usuario').props.children).toBe('Ana');
    });

    it('guardar un nombre nuevo lo guarda y recalcula la simulación con él (demo la activa)', async () => {
      const pantalla = await render(<AjustesScreen />);
      await editar(pantalla, '  demo ');
      await act(async () => {
        fireEvent.press(pantalla.getByTestId('editor-guardar'));
      });
      expect(mockGuardarNombre).toHaveBeenCalledWith('demo');
      expect(sincronizarSimulacion).toHaveBeenCalledWith('demo');
    });

    it('un nombre vacío no se guarda', async () => {
      const pantalla = await render(<AjustesScreen />);
      await editar(pantalla, '   ');
      await act(async () => {
        fireEvent.press(pantalla.getByTestId('editor-guardar'));
      });
      expect(mockGuardarNombre).not.toHaveBeenCalled();
      expect(mostrarModal).toHaveBeenCalled();
    });

    it('avisa de que es modo demo cuando la simulación está activa', async () => {
      useSimulacion.setState({ activa: true });
      const { getByTestId } = await render(<AjustesScreen />);
      expect(getByTestId('aviso-demo')).toBeTruthy();
      useSimulacion.setState({ activa: false });
    });
  });

  describe('borrar datos de la aplicación', () => {
    const abrir = async (pantalla: Awaited<ReturnType<typeof render>>) => {
      await act(async () => {
        fireEvent.press(pantalla.getByTestId('btn-borrar-datos'));
      });
      return (mostrarModal as jest.Mock).mock.lastCall as [string, string, { text: string; style?: string; onPress?: () => any }[]];
    };

    it('pide confirmación antes de borrar nada', async () => {
      const pantalla = await render(<AjustesScreen />);
      const [titulo, mensaje, botones] = await abrir(pantalla);
      expect(titulo).toBe('Borrar datos de la aplicación');
      expect(mensaje).toMatch(/no se puede deshacer/);
      expect(botones.map((b) => b.text)).toEqual(['Cancelar', 'Borrar']);
      expect(borrarDatosApp).not.toHaveBeenCalled();
    });

    it('al confirmar borra todo y vuelve al principio (splash)', async () => {
      const pantalla = await render(<AjustesScreen />);
      const [, , botones] = await abrir(pantalla);
      await act(async () => {
        await botones[1].onPress?.();
      });
      expect(borrarDatosApp).toHaveBeenCalledTimes(1);
      expect(require('expo-router').router.replace).toHaveBeenCalledWith('/');
    });

    it('si falla el borrado avisa y no navega', async () => {
      (borrarDatosApp as jest.Mock).mockRejectedValueOnce(new Error('disco'));
      const pantalla = await render(<AjustesScreen />);
      const [, , botones] = await abrir(pantalla);
      (require('expo-router').router.replace as jest.Mock).mockClear();
      await act(async () => {
        await botones[1].onPress?.();
      });
      expect(require('expo-router').router.replace).not.toHaveBeenCalled();
      expect((mostrarModal as jest.Mock).mock.lastCall![1]).toMatch(/No se han podido borrar los datos/);
    });
  });
});

