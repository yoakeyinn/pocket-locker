import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Modal, ModalHost, mostrarModal } from '../../src/components/Modal';
import { Colors } from '../../src/styles/styles';

describe('Modal', () => {
  it('muestra título, mensaje y los dos botones, y cada uno responde a su pulsación', async () => {
    const izquierdo = jest.fn();
    const derecho = jest.fn();
    const { getByText, getByTestId } = await render(
      <Modal
        visible
        titulo="Título"
        mensaje="Mensaje explicativo"
        izquierdo={{ texto: 'No', onPress: izquierdo }}
        derecho={{ texto: 'Sí', onPress: derecho }}
      />
    );

    expect(getByText('Título')).toBeTruthy();
    expect(getByText('Mensaje explicativo')).toBeTruthy();
    await fireEvent.press(getByTestId('modal-boton-izquierdo'));
    await fireEvent.press(getByTestId('modal-boton-derecho'));
    expect(izquierdo).toHaveBeenCalledTimes(1);
    expect(derecho).toHaveBeenCalledTimes(1);
  });

  it('con un solo botón no pinta el otro', async () => {
    const { getByTestId, queryByTestId } = await render(
      <Modal visible titulo="T" mensaje="M" derecho={{ texto: 'Entendido', onPress: jest.fn() }} />
    );
    expect(getByTestId('modal-boton-derecho')).toBeTruthy();
    expect(queryByTestId('modal-boton-izquierdo')).toBeNull();
  });

  it('oculto no renderiza nada', async () => {
    const { queryByText } = await render(<Modal visible={false} titulo="T" mensaje="M" />);
    expect(queryByText('T')).toBeNull();
  });

  describe('mostrarModal (sustituye a Alert.alert)', () => {
    it('sin botones muestra un único "Aceptar" y se cierra al pulsarlo', async () => {
      const { queryByText, getByText, getByTestId, queryByTestId } = await render(<ModalHost />);
      expect(queryByText('Aviso')).toBeNull();

      await act(async () => mostrarModal('Aviso', 'Algo ha pasado'));
      expect(getByText('Algo ha pasado')).toBeTruthy();
      expect(queryByTestId('modal-boton-izquierdo')).toBeNull();

      await act(async () => {
        fireEvent.press(getByTestId('modal-boton-derecho'));
      });
      expect(queryByText('Algo ha pasado')).toBeNull();
    });

    it('con dos botones, el primero va a la izquierda y el último a la derecha, y cada onPress se ejecuta tras cerrar', async () => {
      const cancelar = jest.fn();
      const aceptar = jest.fn();
      const { getByTestId, queryByText } = await render(<ModalHost />);

      await act(async () =>
        mostrarModal('Borrar', '¿Seguro?', [
          { text: 'Cancelar', style: 'cancel', onPress: cancelar },
          { text: 'Borrar', style: 'destructive', onPress: aceptar },
        ])
      );
      await act(async () => {
        fireEvent.press(getByTestId('modal-boton-derecho'));
      });
      expect(aceptar).toHaveBeenCalledTimes(1);
      expect(cancelar).not.toHaveBeenCalled();
      expect(queryByText('¿Seguro?')).toBeNull();
    });
    it('el botón derecho nunca es rojo, ni siquiera con style "destructive"', async () => {
      const { getByTestId } = await render(<ModalHost />);
      await act(async () =>
        mostrarModal('Borrar', '¿Seguro?', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Borrar', style: 'destructive' },
        ])
      );
      const estilo = StyleSheet.flatten(getByTestId('modal-boton-derecho').props.style) as any;
      expect(estilo.backgroundColor).toBe(Colors.black);
      expect(estilo.borderColor).toBe(Colors.black);
    });
  });
});
