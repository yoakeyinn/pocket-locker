jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native-bluetooth-classic', () => ({ __esModule: true, default: {} }));
jest.mock('react-native-ble-plx', () => ({ BleManager: jest.fn() }));

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import {
  ALTO_FILA,
  ALTO_VER_MAS,
  DeviceDiscoveryListView,
  filasVisibles,
} from '../../src/components/buscar/BuscarComponents';
import { DispositivoBT } from '../../src/services/BluetoothService';

const crear = (n: number): DispositivoBT[] =>
  Array.from({ length: n }, (_, i) => ({ name: `Dispositivo ${i + 1}`, address: `AA:00:00:00:00:0${i}`, type: 'classic' }));

const vista = (dispositivos: DispositivoBT[]) => (
  <DeviceDiscoveryListView
    dispositivos={dispositivos}
    escaneando={false}
    refrescando={false}
    onBuscar={jest.fn()}
    onReintentarAuto={jest.fn()}
    onSeleccionarDispositivo={jest.fn()}
    onAbrirAjustesBluetooth={jest.fn()}
  />
);

describe('lista de dispositivos cercanos', () => {
  it('enseña entre 2 y 3 filas según el alto libre', () => {
    expect(filasVisibles(0)).toBe(3);
    expect(filasVisibles(ALTO_VER_MAS + ALTO_FILA * 3)).toBe(3);
    expect(filasVisibles(ALTO_VER_MAS + ALTO_FILA * 2 + 10)).toBe(2);
    expect(filasVisibles(100)).toBe(2);
    expect(filasVisibles(2000)).toBe(3);
  });

  it('con siete dispositivos enseña tres y «Ver más (4)»; al pulsarlo salen todos y pasa a «Ver menos»', async () => {
    const { getByText, queryByText, getByTestId } = await render(vista(crear(7)));

    expect(getByText('Dispositivo 3')).toBeTruthy();
    expect(queryByText('Dispositivo 4')).toBeNull();
    expect(getByText('Ver más (4)')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('btn-ver-mas'));
    });
    expect(getByText('Dispositivo 7')).toBeTruthy();
    expect(getByText('Ver menos')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('btn-ver-mas'));
    });
    expect(queryByText('Dispositivo 4')).toBeNull();
  });

  it('un dispositivo sin nombre se muestra con el literal «Sin nombre»', async () => {
    const { getByText } = await render(vista([{ name: 'Sin nombre', address: 'AA:00:00:00:00:99', type: 'classic' }]));
    expect(getByText('Sin nombre')).toBeTruthy();
  });

  it('con tres dispositivos o menos no hay «Ver más»', async () => {
    const { queryByTestId, getByText } = await render(vista(crear(3)));
    expect(getByText('Dispositivo 3')).toBeTruthy();
    expect(queryByTestId('btn-ver-mas')).toBeNull();
  });

  it('el aviso «¿No aparece tu Pocket Locker?» y su botón salen siempre, con o sin dispositivos', async () => {
    for (const n of [0, 1, 7]) {
      const { getByTestId, getByText, unmount } = await render(vista(crear(n)));
      expect(getByText('¿No aparece tu Pocket Locker?')).toBeTruthy();
      expect(getByText('Comprueba que esté encendido y cerca, y que el Bluetooth y los permisos estén activos.')).toBeTruthy();
      expect(getByTestId('btn-abrir-ajustes')).toBeTruthy();
      await unmount();
    }
  });

  it('ya no existe el segundo botón de abrir los ajustes de Bluetooth', async () => {
    const { queryByTestId } = await render(vista(crear(2)));
    expect(queryByTestId('btn-abrir-ajustes-footer')).toBeNull();
  });

  it('sin resultados y sin buscar muestra «No se han encontrado dispositivos.»', async () => {
    const { getByTestId, queryByTestId, rerender } = await render(vista([]));
    expect(getByTestId('sin-resultados')).toBeTruthy();

    await rerender(
      <DeviceDiscoveryListView
        dispositivos={[]}
        escaneando
        refrescando={false}
        onBuscar={jest.fn()}
        onReintentarAuto={jest.fn()}
        onSeleccionarDispositivo={jest.fn()}
        onAbrirAjustesBluetooth={jest.fn()}
      />
    );
    expect(queryByTestId('sin-resultados')).toBeNull();
  });
});
