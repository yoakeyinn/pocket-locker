jest.setTimeout(15000);

import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NativeModules, Platform, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import salirApp from 'react-native-exit-app';
import tw from '../../src/styles/styles';
import BluetoothService from '../../src/services/BluetoothService';
import BuscarScreen from '../../src/app/buscar';
import { ModalHost } from '../../src/components/Modal';

const mockBluetooth = BluetoothService as unknown as Record<string, jest.Mock>;

const mockActualizar = jest.fn();

jest.mock('../../src/services/BluetoothService', () => ({
  __esModule: true,
  default: {
    esSoportado: jest.fn(),
    solicitarPermisos: jest.fn(),
    tienePermisos: jest.fn(),
    estaEncendido: jest.fn(),
    pedirActivar: jest.fn(),
    listarDispositivos: jest.fn(),
    cancelarDescubrimiento: jest.fn(() => Promise.resolve()),
    abrirAjustesBluetooth: jest.fn(),
    abrirAjustesApp: jest.fn(),
    vincularDispositivo: jest.fn(),
  },
  useBluetooth: () => ({ userName: 'Ana', actualizarDispositivoVinculado: mockActualizar }),
}));

jest.mock('../../src/services/StorageService', () => ({
  DEFAULT_SECURITY_PIN: '2415',
  LogService: { warn: jest.fn() },
}));

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  readDirectoryAsync: jest.fn().mockResolvedValue([]),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

describe('BuscarScreen', () => {
  beforeAll(() => {
    (NativeModules as any).RNExitApp = {};
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockBluetooth.esSoportado.mockResolvedValue(true);
    mockBluetooth.solicitarPermisos.mockResolvedValue(true);
    mockBluetooth.tienePermisos.mockResolvedValue(true);
    mockBluetooth.estaEncendido.mockResolvedValue(true);
    mockBluetooth.listarDispositivos.mockResolvedValue([]);
  });

  it('empieza con el radar y solo el botón de ver dispositivos manualmente', async () => {
    mockBluetooth.listarDispositivos.mockReturnValue(new Promise(() => {}));
    const { getByText, getAllByText, getByTestId, queryByTestId, queryByText } = await render(<BuscarScreen />);
    expect(getAllByText('Buscando tu Pocket Locker')).toHaveLength(1);
    expect(getByText('Ver dispositivos manualmente')).toBeTruthy();
    expect(getByTestId('btn-ir-manual')).toBeTruthy();
    expect(queryByText('Búsqueda inteligente en segundo plano')).toBeNull();
    expect(queryByTestId('btn-continuar-sin-bluetooth')).toBeNull();
    expect(getByTestId('radar-estrellas')).toBeTruthy();
    expect(queryByTestId('radar-objetivo')).toBeNull();
  });

  it('sin Bluetooth en el build muestra el aviso en la lista de dispositivos', async () => {
    mockBluetooth.esSoportado.mockResolvedValue(false);
    const { findByTestId, getByText } = await render(<BuscarScreen />);

    expect(await findByTestId('aviso-sin-bluetooth')).toBeTruthy();
    expect(getByText('Dispositivos cercanos')).toBeTruthy();
  });

  it('con el Bluetooth apagado no salen dispositivos: aparece el aviso con «Activar Bluetooth» y «Abrir ajustes del teléfono»', async () => {
    mockBluetooth.estaEncendido.mockResolvedValue(false);
    mockBluetooth.pedirActivar.mockResolvedValue(true);
    mockBluetooth.abrirAjustesBluetooth.mockResolvedValue(undefined);
    const { findByTestId, getByTestId, queryByTestId, queryByText } = await render(<BuscarScreen />);
    expect(await findByTestId('aviso-bluetooth-apagado')).toBeTruthy();
    expect(mockBluetooth.listarDispositivos).not.toHaveBeenCalled();
    expect(queryByText('Dispositivo 1')).toBeNull();
    expect(queryByTestId('sin-resultados')).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId('btn-activar-bluetooth'));
    });
    expect(mockBluetooth.pedirActivar).toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(getByTestId('btn-abrir-ajustes-bluetooth'));
    });
    expect(mockBluetooth.abrirAjustesBluetooth).toHaveBeenCalled();
  });

  it('al encenderse el Bluetooth el aviso desaparece y se busca de nuevo; si se apaga mientras busca, vuelve el aviso y se vacía la lista', async () => {
    mockBluetooth.estaEncendido.mockResolvedValue(false);
    const { findByTestId, getByTestId, queryByTestId, getByText } = await render(<BuscarScreen />);
    await findByTestId('aviso-bluetooth-apagado');

    mockBluetooth.estaEncendido.mockResolvedValue(true);
    mockBluetooth.listarDispositivos.mockImplementation(async (alEncontrar: (d: any) => void) => {
      alEncontrar({ name: 'Auriculares', address: 'AA:01', type: 'classic' });
      return new Promise(() => {});
    });
    await act(async () => {
      fireEvent.press(getByTestId('btn-buscar-dispositivos'));
    });
    await waitFor(() => expect(queryByTestId('aviso-bluetooth-apagado')).toBeNull());
    expect(await waitFor(() => getByText('Auriculares'))).toBeTruthy();

    mockBluetooth.estaEncendido.mockResolvedValue(false);
    await waitFor(() => expect(getByTestId('aviso-bluetooth-apagado')).toBeTruthy(), { timeout: 4000 });
    expect(queryByTestId('lista-dispositivos')).toBeTruthy();
    expect(() => getByText('Auriculares')).toThrow();
  });

  it('sin Bluetooth, tanto «Buscar de nuevo» como el botón del radar abren el modal «Bluetooth no disponible»', async () => {
    mockBluetooth.esSoportado.mockResolvedValue(false);
    const { findByTestId, getByTestId, findByText, queryByText, queryByTestId } = await render(<><BuscarScreen /><ModalHost /></>);
    await findByTestId('aviso-sin-bluetooth');
    expect(queryByText('Bluetooth no disponible')).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId('btn-reintentar-auto'));
    });
    expect(await findByText('Bluetooth no disponible')).toBeTruthy();
    expect(queryByTestId('radar-estrellas')).toBeNull();
    await act(async () => {
      fireEvent.press(getByTestId('modal-boton-derecho'));
    });

    await act(async () => {
      fireEvent.press(getByTestId('btn-buscar-dispositivos'));
    });
    expect(await findByText('Bluetooth no disponible')).toBeTruthy();
  });

  it('el modal «Bluetooth no disponible» explica qué hacer (formal) con «Salir» en rojo y «Ajustes»', async () => {
    mockBluetooth.esSoportado.mockResolvedValue(false);
    mockBluetooth.abrirAjustesBluetooth.mockResolvedValue(undefined);
    const { findByTestId, getByTestId, findByText, getByText } = await render(<><BuscarScreen /><ModalHost /></>);
    await findByTestId('aviso-sin-bluetooth');
    await act(async () => {
      fireEvent.press(getByTestId('btn-buscar-dispositivos'));
    });

    await findByText('Bluetooth no disponible');
    expect(getByText(/le rogamos que compruebe lo siguiente/)).toBeTruthy();
    expect(getByText(/1\. Que su teléfono disponga de Bluetooth/)).toBeTruthy();
    expect(getByText(/2\. Que la aplicación tenga permiso/)).toBeTruthy();
    expect(getByText(/3\. Que su Pocket Locker esté encendido/)).toBeTruthy();

    const rojo = (StyleSheet.flatten(tw`text-red`) as any).color;
    expect((StyleSheet.flatten(getByText('Salir').props.style) as any).color).toBe(rojo);
    expect((StyleSheet.flatten(getByTestId('modal-boton-izquierdo').props.style) as any).borderColor).toBe(rojo);
    expect(getByText('Ajustes')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('modal-boton-derecho'));
    });
    expect(mockBluetooth.abrirAjustesBluetooth).toHaveBeenCalled();
  });

  it('«Salir» cierra la aplicación del todo', async () => {
    (Platform as any).OS = 'android';
    mockBluetooth.esSoportado.mockResolvedValue(false);
    const { findByTestId, getByTestId, findByText } = await render(<><BuscarScreen /><ModalHost /></>);
    await findByTestId('aviso-sin-bluetooth');
    await act(async () => {
      fireEvent.press(getByTestId('btn-buscar-dispositivos'));
    });
    await findByText('Bluetooth no disponible');
    await act(async () => {
      fireEvent.press(getByTestId('modal-boton-izquierdo'));
    });
    await waitFor(() => expect(salirApp.exitApp).toHaveBeenCalled());
  });

  it('el botón de ajustes de la lista lleva a la pantalla de ajustes de la app', async () => {
    mockBluetooth.esSoportado.mockResolvedValue(false);
    const { findByTestId, getByTestId } = await render(<BuscarScreen />);
    await findByTestId('aviso-sin-bluetooth');
    await act(async () => {
      fireEvent.press(getByTestId('btn-ajustes'));
    });
    expect(router.push).toHaveBeenCalledWith('/ajustes');
  });

  it('sin permisos explica para qué se piden antes de lanzar el diálogo del sistema', async () => {
    mockBluetooth.tienePermisos.mockResolvedValue(false);
    const { findByText, getByTestId } = await render(<BuscarScreen />);

    expect(await findByText('Permisos requeridos')).toBeTruthy();
    expect(mockBluetooth.solicitarPermisos).not.toHaveBeenCalled();

    mockBluetooth.listarDispositivos.mockReturnValue(new Promise(() => {}));
    await act(async () => {
      fireEvent.press(getByTestId('btn-conceder-permisos'));
    });
    expect(mockBluetooth.solicitarPermisos).toHaveBeenCalled();
  });

  it('al detectar el locker muestra el modal de confirmación antes de vincular', async () => {
    mockBluetooth.listarDispositivos.mockImplementation(async (alEncontrar: (d: any) => void) => {
      alEncontrar({ name: 'PLBT', address: 'AA:BB', type: 'classic' });
      return new Promise(() => {});
    });
    const { getByTestId, findByTestId, findByText, getByText, queryByText } = await render(<><BuscarScreen /><ModalHost /></>);

    await waitFor(() => expect(getByTestId('radar-objetivo')).toBeTruthy());
    expect(queryByText('Dispositivo detectado')).toBeNull();
    expect(queryByText(/detectado!/)).toBeNull();

    expect(await findByText('Dispositivo detectado', {}, { timeout: 3000 })).toBeTruthy();
    expect(getByText(/«PLBT»/)).toBeTruthy();
    expect(mockBluetooth.vincularDispositivo).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(getByTestId('modal-boton-derecho'));
    });

    expect(await findByTestId('input-nombre')).toBeTruthy();
    expect(getByTestId('input-nombre').props.value).toBe('PLBT');
    expect(mockBluetooth.vincularDispositivo).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.changeText(getByTestId('input-nombre'), 'Mi portal');
      fireEvent.changeText(getByTestId('input-pin'), '2415');
    });
    await act(async () => {
      fireEvent.press(getByTestId('modal-boton-derecho'));
    });

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/puertas'));
    expect(mockBluetooth.vincularDispositivo).toHaveBeenCalledWith('AA:BB');
    expect(mockActualizar).toHaveBeenCalledWith('AA:BB', 'Mi portal', 'classic', '2415', 'Ana');
  });

  it('si se cancela el modal pasa a la lista manual sin vincular', async () => {
    mockBluetooth.listarDispositivos
      .mockImplementationOnce(async (alEncontrar: (d: any) => void) => {
        alEncontrar({ name: 'PLBT', address: 'AA:BB', type: 'classic' });
        return new Promise(() => {});
      })
      .mockResolvedValue([]);
    const { findByText, getByTestId } = await render(<><BuscarScreen /><ModalHost /></>);

    await findByText('Dispositivo detectado', {}, { timeout: 3000 });
    await act(async () => {
      fireEvent.press(getByTestId('modal-boton-izquierdo'));
    });

    expect(await findByText('Dispositivos cercanos')).toBeTruthy();
    expect(mockBluetooth.vincularDispositivo).not.toHaveBeenCalled();
  });
});
