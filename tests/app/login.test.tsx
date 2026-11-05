import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import LoginScreen from '../../src/app/login';
import { useBluetooth } from '../../src/services/BluetoothService';
import { StorageService } from '../../src/services/StorageService';
import { sincronizarSimulacion } from '../../src/services/Simulacion';
import { setIdioma, t } from '../../src/styles/i18n';

jest.mock('../../src/services/BluetoothService', () => ({
  __esModule: true,
  useBluetooth: jest.fn(),
}));
jest.mock('../../src/services/StorageService', () => ({
  LogService: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  StorageService: { saveIdioma: jest.fn().mockResolvedValue(undefined), saveBiometria: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../../src/services/Simulacion', () => ({ sincronizarSimulacion: jest.fn().mockResolvedValue(undefined) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

describe('LoginScreen', () => {
  const guardarNombreUsuario = jest.fn().mockResolvedValue(undefined);
  const estado = (deviceMac: string | null) =>
    (useBluetooth as jest.Mock).mockReturnValue({ deviceMac, guardarNombreUsuario });

  beforeEach(() => {
    jest.clearAllMocks();
    setIdioma('es');
    estado(null);
  });

  it('da la bienvenida (neutra), describe la app y pide el nombre más abajo', async () => {
    const { getByText, getByTestId } = await render(<LoginScreen />);
    expect(getByText('Bienvenidx')).toBeTruthy();
    expect(getByText(/puede abrir sus puertas desde su smartphone/)).toBeTruthy();
    expect(getByTestId('input-nombre-usuario')).toBeTruthy();
    expect(getByTestId('btn-continuar-login')).toBeTruthy();
  });

  it('lleva delante del título la estrella de carga que gira', async () => {
    const { getByTestId } = await render(<LoginScreen />);
    expect(getByTestId('cargando')).toBeTruthy();
  });

  it('sin nombre muestra el error bajo el campo (sin modales) y no guarda nada', async () => {
    const { getByTestId } = await render(<LoginScreen />);
    await act(async () => {
      fireEvent.press(getByTestId('btn-continuar-login'));
    });
    expect(getByTestId('error-nombre-usuario')).toBeTruthy();
    expect(guardarNombreUsuario).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('si el error «Introduce tu nombre» ya se está mostrando y se cambia el idioma, se traduce', async () => {
    const { getByTestId, getByText, queryByText } = await render(<LoginScreen />);
    await act(async () => {
      fireEvent.press(getByTestId('btn-continuar-login'));
    });
    expect(getByText('Introduce tu nombre para continuar.')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('btn-preferencias'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('idioma-en'));
    });
    expect(getByText('Enter your name to continue.')).toBeTruthy();
    expect(queryByText('Introduce tu nombre para continuar.')).toBeNull();
  });

  it('el error desaparece al escribir', async () => {
    const { getByTestId, queryByTestId } = await render(<LoginScreen />);
    await act(async () => {
      fireEvent.press(getByTestId('btn-continuar-login'));
    });
    await act(async () => {
      fireEvent.changeText(getByTestId('input-nombre-usuario'), 'A');
    });
    expect(queryByTestId('error-nombre-usuario')).toBeNull();
  });

  it('guarda el nombre sin espacios y va a la búsqueda si no hay dispositivo', async () => {
    const { getByTestId } = await render(<LoginScreen />);
    await act(async () => {
      fireEvent.changeText(getByTestId('input-nombre-usuario'), '  Ana  ');
    });
    await act(async () => {
      fireEvent.press(getByTestId('btn-continuar-login'));
    });
    expect(guardarNombreUsuario).toHaveBeenCalledWith('Ana');
    expect(router.replace).toHaveBeenCalledWith('/buscar');
  });

  it('el nombre guardado decide si hay simulación: se lo pasa a sincronizarSimulacion (demo la activa)', async () => {
    const { getByTestId } = await render(<LoginScreen />);
    await act(async () => {
      fireEvent.changeText(getByTestId('input-nombre-usuario'), 'demo');
    });
    await act(async () => {
      fireEvent.press(getByTestId('btn-continuar-login'));
    });
    expect(sincronizarSimulacion).toHaveBeenCalledWith('demo');
  });

  it('con dispositivo vinculado va a las puertas', async () => {
    estado('AA:BB');
    const { getByTestId } = await render(<LoginScreen />);
    await act(async () => {
      fireEvent.changeText(getByTestId('input-nombre-usuario'), 'Ana');
    });
    await act(async () => {
      fireEvent.press(getByTestId('btn-continuar-login'));
    });
    expect(router.replace).toHaveBeenCalledWith('/puertas');
  });

  describe('preferencias', () => {
    it('empiezan plegadas y se despliegan y pliegan al pulsar la cabecera', async () => {
      const { getByTestId, queryByTestId, getByText } = await render(<LoginScreen />);
      expect(getByText('Preferencias')).toBeTruthy();
      expect(queryByTestId('idioma-en')).toBeNull();
      expect(queryByTestId('tema-oscuro')).toBeNull();
      expect(queryByTestId('interruptor-biometria')).toBeNull();

      await act(async () => {
        fireEvent.press(getByTestId('btn-preferencias'));
      });
      expect(getByTestId('idioma-en')).toBeTruthy();
      expect(getByTestId('tema-oscuro')).toBeTruthy();
      expect(getByTestId('interruptor-biometria')).toBeTruthy();

      await act(async () => {
        fireEvent.press(getByTestId('btn-preferencias'));
      });
      expect(queryByTestId('idioma-en')).toBeNull();
    });

    it('si no se verifica la identidad al marcar la huella: error bajo «Continuar», no deja continuar y se arregla desmarcando', async () => {
      const LocalAuthentication = require('expo-local-authentication');
      LocalAuthentication.authenticateAsync.mockResolvedValueOnce({ success: false, error: 'user_cancel' });
      estado(null);
      const { getByTestId, queryByTestId } = await render(<LoginScreen />);
      await act(async () => {
        fireEvent.changeText(getByTestId('input-nombre-usuario'), 'Ana');
      });
      await act(async () => {
        fireEvent.press(getByTestId('btn-preferencias'));
      });
      await act(async () => {
        fireEvent.press(getByTestId('interruptor-biometria'));
      });
      expect(getByTestId('error-biometria').props.children).toBe('No se pudo verificar la identidad. Inténtalo de nuevo o desactiva esta preferencia.');

      await act(async () => {
        fireEvent.press(getByTestId('btn-continuar-login'));
      });
      expect(guardarNombreUsuario).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();

      await act(async () => {
        fireEvent.press(getByTestId('interruptor-biometria'));
      });
      expect(queryByTestId('error-biometria')).toBeNull();
      await act(async () => {
        fireEvent.press(getByTestId('btn-continuar-login'));
      });
      expect(guardarNombreUsuario).toHaveBeenCalledWith('Ana');
    });

    it('cambiar el idioma traduce la pantalla al momento y lo guarda', async () => {
      const { getByTestId, getByText } = await render(<LoginScreen />);
      await act(async () => {
        fireEvent.press(getByTestId('btn-preferencias'));
      });
      await act(async () => {
        fireEvent.press(getByTestId('idioma-en'));
      });
      expect(getByText('Welcome')).toBeTruthy();
      expect(getByText('Preferences')).toBeTruthy();
      expect(StorageService.saveIdioma).toHaveBeenCalledWith('en');

      await act(async () => {
        fireEvent.press(getByTestId('idioma-es'));
      });
      expect(getByText('Bienvenidx')).toBeTruthy();
      expect(t('pl_idioma')).toBe('Idioma');
    });
  });
});
