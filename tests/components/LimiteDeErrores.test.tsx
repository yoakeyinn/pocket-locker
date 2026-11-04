jest.mock('../../src/services/ErrorService', () => ({ reportarErrorFatal: jest.fn() }));

import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { LimiteDeErrores } from '../../src/components/LimiteDeErrores';
import { reportarErrorFatal } from '../../src/services/ErrorService';

const Roto = () => {
  throw new Error('pantalla rota');
};

describe('LimiteDeErrores', () => {
  beforeEach(() => {
    (reportarErrorFatal as jest.Mock).mockClear();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('si una pantalla falla al dibujarse, informa del error fatal y deja un fondo vacío', async () => {
    await render(
      <LimiteDeErrores>
        <Roto />
      </LimiteDeErrores>
    );

    expect(reportarErrorFatal).toHaveBeenCalledTimes(1);
    const [error, contexto] = (reportarErrorFatal as jest.Mock).mock.calls[0];
    expect(error.message).toBe('pantalla rota');
    expect(contexto).toContain('Error al dibujar la pantalla');
  });

  it('si todo va bien, pinta a sus hijos sin avisar de nada', async () => {
    const { getByText } = await render(
      <LimiteDeErrores>
        <Text>contenido</Text>
      </LimiteDeErrores>
    );
    expect(getByText('contenido')).toBeTruthy();
    expect(reportarErrorFatal).not.toHaveBeenCalled();
  });
});
