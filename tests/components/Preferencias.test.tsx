jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Preferencias } from '../../src/components/Preferencias';
import { usePreferencias } from '../../src/services/preferencias';
import { setIdioma } from '../../src/styles/i18n';
import { Colors, setTema } from '../../src/styles/styles';

const nivel = LocalAuthentication.getEnrolledLevelAsync as jest.Mock;
const autenticar = LocalAuthentication.authenticateAsync as jest.Mock;

describe('Preferencias (idioma, tema y bloqueo de la app)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    setIdioma('es');
    setTema('claro');
    usePreferencias.setState({ biometria: false, desbloqueada: false, cargadas: true });
    nivel.mockResolvedValue(3);
    autenticar.mockResolvedValue({ success: true });
  });

  const activar = async (pantalla: Awaited<ReturnType<typeof render>>) => {
    await act(async () => {
      fireEvent.press(pantalla.getByTestId('interruptor-biometria'));
    });
  };

  it('muestra las tres preferencias; con huella registrada el bloqueo se llama «Huella dactilar»', async () => {
    const { getByText, findByText } = await render(<Preferencias />);
    expect(getByText('Idioma')).toBeTruthy();
    expect(getByText('Tema')).toBeTruthy();
    expect(await findByText('Huella dactilar')).toBeTruthy();
  });

  it('sin huella pero con PIN o patrón, la opción es usar el PIN o patrón del teléfono', async () => {
    nivel.mockResolvedValue(1);
    const { findByText } = await render(<Preferencias />);
    expect(await findByText('PIN o patrón del teléfono')).toBeTruthy();
  });

  it('sin ninguna seguridad en el teléfono la fila es genérica', async () => {
    nivel.mockResolvedValue(0);
    const { findByText } = await render(<Preferencias />);
    expect(await findByText('Bloqueo de la app')).toBeTruthy();
  });

  it('elegir «Oscuro» cambia el tema al momento y se guarda', async () => {
    const { getByTestId } = await render(<Preferencias />);
    await act(async () => {
      fireEvent.press(getByTestId('tema-oscuro'));
    });
    expect(Colors.beige).toBe('#0F0F0F');
    expect(await AsyncStorage.getItem('tema')).toBe('oscuro');
  });

  it('activar el bloqueo pide confirmarlo con el sistema del teléfono, la guarda y deja la sesión desbloqueada', async () => {
    const pantalla = await render(<Preferencias />);
    await activar(pantalla);

    expect(autenticar).toHaveBeenCalledTimes(1);
    expect(usePreferencias.getState()).toMatchObject({ biometria: true, desbloqueada: true });
    expect(await AsyncStorage.getItem('biometria')).toBe('si');
    expect(pantalla.getByTestId('interruptor-biometria').props.accessibilityState).toEqual({ checked: true });
  });

  it('con PIN o patrón del teléfono también se puede activar (se confirma con él)', async () => {
    nivel.mockResolvedValue(1);
    const pantalla = await render(<Preferencias />);
    await activar(pantalla);
    expect(autenticar).toHaveBeenCalledTimes(1);
    expect(usePreferencias.getState().biometria).toBe(true);
  });

  it('sin huella, PIN ni patrón no se activa y lo explica bajo la fila', async () => {
    nivel.mockResolvedValue(0);
    const pantalla = await render(<Preferencias />);
    await activar(pantalla);

    expect(pantalla.getByText(/no tiene huella dactilar, PIN ni patrón configurados/)).toBeTruthy();
    expect(usePreferencias.getState().biometria).toBe(false);
    expect(autenticar).not.toHaveBeenCalled();
  });

  it('si la confirmación falla no se activa y lo indica', async () => {
    autenticar.mockResolvedValue({ success: false, error: 'user_cancel' });
    const pantalla = await render(<Preferencias />);
    await activar(pantalla);
    expect(pantalla.getByTestId('error-biometria')).toBeTruthy();
    expect(usePreferencias.getState().biometria).toBe(false);
  });

  it('el error de la fila de bloqueo, si ya se muestra, se traduce al cambiar de idioma', async () => {
    autenticar.mockResolvedValue({ success: false, error: 'user_cancel' });
    const pantalla = await render(<Preferencias />);
    await activar(pantalla);
    expect(pantalla.getByText('No se pudo verificar la identidad. Inténtalo de nuevo.')).toBeTruthy();

    await act(async () => setIdioma('en'));
    expect(pantalla.getByText('Your identity could not be verified. Please try again.')).toBeTruthy();
  });

  it('desactivarla no pide huella', async () => {
    usePreferencias.setState({ biometria: true });
    const pantalla = await render(<Preferencias />);
    await activar(pantalla);
    expect(autenticar).not.toHaveBeenCalled();
    expect(usePreferencias.getState().biometria).toBe(false);
    expect(await AsyncStorage.getItem('biometria')).toBe('no');
  });
});
