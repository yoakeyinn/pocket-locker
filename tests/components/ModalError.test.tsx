jest.mock('../../src/services/StorageService', () => ({ LogService: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  readDirectoryAsync: jest.fn().mockResolvedValue(['a.tmp', 'b.tmp']),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(true) }));

import React from 'react';
import { NativeModules, Platform, StyleSheet } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as FileSystem from 'expo-file-system/legacy';
import salirApp from 'react-native-exit-app';
import * as Clipboard from 'expo-clipboard';
import tw from '../../src/styles/styles';
import { ModalHost, mostrarModal, mostrarModalError } from '../../src/components/Modal';

const INFORME = 'Pocket Locker v1.4.0 - informe de error\nERROR\nError: algo ha fallado\nPila: en puertas.tsx:10';

describe('modal de error fatal (mostrarModalError)', () => {
  beforeAll(() => {
    (NativeModules as any).RNExitApp = {};
  });

  beforeEach(() => {
    (Platform as any).OS = 'android';
  });
  afterEach(() => jest.restoreAllMocks());

  it('muestra el aviso con "Ver logs" a la izquierda y "Cerrar" a la derecha, y el registro oculto', async () => {
    const { getByText, getByTestId, queryByTestId } = await render(<ModalHost />);
    await act(async () => mostrarModalError('Algo ha salido mal', 'No puede continuar.', INFORME));

    expect(getByText('Algo ha salido mal')).toBeTruthy();
    expect(getByText('Ver logs')).toBeTruthy();
    expect(getByText('Cerrar')).toBeTruthy();
    expect(getByTestId('modal-boton-izquierdo')).toBeTruthy();
    expect(getByTestId('modal-boton-derecho')).toBeTruthy();
    expect(queryByTestId('modal-registro')).toBeNull();
  });

  it('solo el título va en rojo; el botón "Cerrar" es negro como los demás', async () => {
    const { getByText, getByTestId } = await render(<ModalHost />);
    await act(async () => mostrarModalError('Algo ha salido mal', 'No puede continuar.', INFORME));

    const estilo = (el: any) => StyleSheet.flatten(el.props.style) as Record<string, any>;
    expect(estilo(getByText('Algo ha salido mal')).color).toBe(estilo({ props: { style: tw`text-red` } }).color);
    expect(estilo(getByTestId('modal-boton-derecho')).backgroundColor).toBe(
      estilo({ props: { style: tw`bg-black` } }).backgroundColor
    );
  });

  it('"Ver logs" despliega el registro completo y cambia a "Ocultar logs" sin cerrar el modal', async () => {
    const { getByText, getByTestId, queryByTestId } = await render(<ModalHost />);
    await act(async () => mostrarModalError('Algo ha salido mal', 'No puede continuar.', INFORME));

    await act(async () => {
      fireEvent.press(getByTestId('modal-boton-izquierdo'));
    });
    expect(getByTestId('modal-registro')).toBeTruthy();
    expect(getByText(/Pila: en puertas.tsx:10/)).toBeTruthy();
    expect(getByText('Ocultar logs')).toBeTruthy();
    expect(getByText('Algo ha salido mal')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('modal-boton-izquierdo'));
    });
    expect(queryByTestId('modal-registro')).toBeNull();
  });

  it('el icono de copiar pone el registro entero en el portapapeles y confirma con "Copiado"', async () => {
    const { getByText, getByTestId } = await render(<ModalHost />);
    await act(async () => mostrarModalError('Algo ha salido mal', 'No puede continuar.', INFORME));
    await act(async () => {
      fireEvent.press(getByTestId('modal-boton-izquierdo'));
    });

    await act(async () => {
      fireEvent.press(getByTestId('modal-copiar'));
    });
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(INFORME);
    expect(getByText('Copiado')).toBeTruthy();
  });

  it('"Cerrar" cierra la aplicación del todo y limpia la caché', async () => {
    const { getByTestId } = await render(<ModalHost />);
    await act(async () => mostrarModalError('Algo ha salido mal', 'No puede continuar.', INFORME));

    await act(async () => {
      fireEvent.press(getByTestId('modal-boton-derecho'));
    });
    await waitFor(() => expect(salirApp.exitApp).toHaveBeenCalled());
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///cache/a.tmp', { idempotent: true });
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///cache/b.tmp', { idempotent: true });
  });

  it('un modal normal posterior no tapa el error fatal', async () => {
    const { getByText, queryByText } = await render(<ModalHost />);
    await act(async () => mostrarModalError('Algo ha salido mal', 'No puede continuar.', INFORME));
    await act(async () => mostrarModal('Aviso menor', 'Esto no debe sustituir al error'));

    expect(getByText('Algo ha salido mal')).toBeTruthy();
    expect(queryByText('Aviso menor')).toBeNull();
  });
});
