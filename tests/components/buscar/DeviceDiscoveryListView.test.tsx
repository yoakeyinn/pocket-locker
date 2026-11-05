jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native-bluetooth-classic', () => ({ __esModule: true, default: {} }));
jest.mock('react-native-ble-plx', () => ({ BleManager: jest.fn() }));

import React from 'react';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { DeviceDiscoveryListView } from '../../../src/components/buscar/DeviceDiscoveryListView';
import { DispositivoBT } from '../../../src/services/BluetoothService';

const crear = (n: number): DispositivoBT[] =>
  Array.from({ length: n }, (_, i) => ({ name: `Dispositivo ${i + 1}`, address: `AA:00:00:00:00:${String(i).padStart(2, '0')}`, type: 'classic' }));

const irAjustes = jest.fn();
const activar = jest.fn();
const abrirAjustes = jest.fn();

const vista = (dispositivos: DispositivoBT[], extra: Partial<React.ComponentProps<typeof DeviceDiscoveryListView>> = {}) => (
  <DeviceDiscoveryListView
    dispositivos={dispositivos}
    escaneando={false}
    refrescando={false}
    onBuscar={jest.fn()}
    onReintentarAuto={jest.fn()}
    onSeleccionarDispositivo={jest.fn()}
    onActivarBluetooth={activar}
    onAbrirAjustesBluetooth={abrirAjustes}
    onIrAjustes={irAjustes}
    {...extra}
  />
);

describe('lista de dispositivos cercanos', () => {
  it('enseña todos los dispositivos que aparezcan, sin «Ver más»', async () => {
    const { getByText, queryByTestId, queryByText } = await render(vista(crear(10)));
    for (let i = 1; i <= 10; i++) expect(getByText(`Dispositivo ${i}`)).toBeTruthy();
    expect(queryByTestId('btn-ver-mas')).toBeNull();
    expect(queryByText(/Ver más|Ver menos/)).toBeNull();
  });

  it('un dispositivo sin nombre se muestra con el literal «Sin nombre»', async () => {
    const { getByText } = await render(vista([{ name: 'Sin nombre', address: 'AA:00:00:00:00:99', type: 'classic' }]));
    expect(getByText('Sin nombre')).toBeTruthy();
  });

  it('con el Bluetooth apagado no enseña dispositivos ni «sin resultados»: enseña el aviso con sus dos botones', async () => {
    const { getByTestId, queryByText, queryByTestId } = await render(vista(crear(3), { bluetoothApagado: true }));
    expect(getByTestId('aviso-bluetooth-apagado')).toBeTruthy();
    expect(queryByText('Dispositivo 1')).toBeNull();
    expect(queryByTestId('sin-resultados')).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId('btn-activar-bluetooth'));
      fireEvent.press(getByTestId('btn-abrir-ajustes-bluetooth'));
    });
    expect(activar).toHaveBeenCalledTimes(1);
    expect(abrirAjustes).toHaveBeenCalledTimes(1);
  });

  it('ya no hay tarjeta flotante «¿No aparece tu Pocket Locker?»', async () => {
    const { queryByTestId, queryByText } = await render(vista(crear(2)));
    expect(queryByTestId('aviso-no-aparece')).toBeNull();
    expect(queryByText(/¿No aparece/)).toBeNull();
  });

  it('sin resultados y sin buscar muestra «No se han encontrado dispositivos.»', async () => {
    const { getByTestId, queryByTestId, rerender } = await render(vista([]));
    expect(getByTestId('sin-resultados')).toBeTruthy();

    await rerender(vista([], { escaneando: true }));
    expect(queryByTestId('sin-resultados')).toBeNull();
  });

  it('junto al botón del radar hay un botón de ajustes que lleva a la pantalla de ajustes de la app', async () => {
    const { getByTestId } = await render(vista(crear(1)));
    expect(getByTestId('btn-reintentar-auto')).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByTestId('btn-ajustes'));
    });
    expect(irAjustes).toHaveBeenCalledTimes(1);
  });

  it('al recargar tirando de la lista el botón pasa a «Buscando...» y se deshabilita', async () => {
    const { getByTestId, getByText } = await render(vista(crear(2), { refrescando: true }));
    expect(getByText('Buscando...')).toBeTruthy();
    expect(getByTestId('btn-buscar-dispositivos').props.accessibilityState?.disabled ?? getByTestId('btn-buscar-dispositivos').props.disabled).toBeTruthy();
  });

  it('cabecera y filas están dentro de una misma lista que se desplaza', async () => {
    const { getByTestId } = await render(vista(crear(7)));
    const lista = within(getByTestId('lista-dispositivos'));
    expect(lista.getByText('Dispositivos cercanos')).toBeTruthy();
    expect(lista.getByTestId('btn-buscar-dispositivos')).toBeTruthy();
    expect(lista.getByText('Dispositivo 1')).toBeTruthy();
    expect(lista.getByText('Dispositivo 7')).toBeTruthy();
  });
});
