jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native-bluetooth-classic', () => ({ __esModule: true, default: {} }));
jest.mock('react-native-ble-plx', () => ({ BleManager: jest.fn() }));

import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { ModalVincularDispositivo } from '../../../src/components/buscar/ModalVincularDispositivo';
import { activarSimulacion, desactivarSimulacion } from '../../../src/services/Simulacion';
import { Colors } from '../../../src/styles/styles';

const modal = (extra: Partial<React.ComponentProps<typeof ModalVincularDispositivo>> = {}) => (
  <ModalVincularDispositivo
    visible
    guardando={false}
    nombrePersonalizado="Pocket Locker"
    setNombrePersonalizado={() => {}}
    pinSeguridad=""
    setPinSeguridad={() => {}}
    onCancel={() => {}}
    onConfirm={() => {}}
    {...extra}
  />
);

const borde = (el: any) => (StyleSheet.flatten(el.props.style) as any).borderColor;

describe('modal de vincular dispositivo', () => {
  afterEach(() => desactivarSimulacion());

  it('un usuario normal no ve el PIN entre paréntesis', async () => {
    const { getByText, queryByText } = await render(modal());
    expect(getByText('Introduce el PIN de seguridad para vincular este Pocket Locker.')).toBeTruthy();
    expect(queryByText(/2415/)).toBeNull();
  });

  it('en el modo demo sí se muestra el PIN', async () => {
    activarSimulacion();
    const { getByText } = await render(modal());
    expect(getByText('Introduce el PIN de seguridad (2415) para vincular este Pocket Locker.')).toBeTruthy();
  });

  it('sin errores, ni mensajes rojos ni bordes rojos', async () => {
    const { queryByTestId, getByTestId } = await render(modal());
    expect(queryByTestId('error-pin')).toBeNull();
    expect(queryByTestId('error-nombre')).toBeNull();
    expect(borde(getByTestId('input-pin'))).toBe(Colors.silver);
  });

  it('el error del PIN sale bajo el campo PIN, en rojo, con el borde del campo en rojo', async () => {
    const { getByTestId } = await render(modal({ errorPin: 'Introduce el PIN de seguridad.' }));
    expect((StyleSheet.flatten(getByTestId('error-pin').props.style) as any).color).toBe(Colors.red);
    expect(borde(getByTestId('input-pin'))).toBe(Colors.red);
    expect(borde(getByTestId('input-nombre'))).toBe(Colors.silver);
  });

  it('el error de vinculación sale bajo el campo del nombre, en rojo, con su borde en rojo', async () => {
    const { getByTestId, queryByTestId } = await render(modal({ errorNombre: 'Error de vinculación' }));
    expect((StyleSheet.flatten(getByTestId('error-nombre').props.style) as any).color).toBe(Colors.red);
    expect(borde(getByTestId('input-nombre'))).toBe(Colors.red);
    expect(queryByTestId('error-pin')).toBeNull();
  });
});
