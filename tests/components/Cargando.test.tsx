import fs from 'fs';
import path from 'path';
import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { Cargando, GIRO_CARGANDO_MS } from '../../src/components/Cargando';
import { Boton } from '../../src/components/Boton';
import { Colors } from '../../src/styles/styles';

const archivos = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? archivos(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []
  );

describe('indicador de carga', () => {
  it('es la estrella apagada del splash (plata) y gira muy despacio', async () => {
    const { getByTestId } = await render(<Cargando tamano={24} />);
    const caja = getByTestId('cargando');
    const estilo = StyleSheet.flatten(caja.props.style) as any;

    expect(estilo.transform[0].rotate).toBeDefined();
    expect(GIRO_CARGANDO_MS).toBeGreaterThanOrEqual(6000);
    expect(caja.props.children.props.color).toBe(Colors.silver);
  });

  it('un botón cargando muestra la estrella en lugar del icono', async () => {
    const { getByTestId, queryByText } = await render(
      <Boton testID="b" icono="refresh" texto="Buscando..." cargando onPress={() => {}} />
    );
    expect(getByTestId('cargando')).toBeTruthy();
    expect(queryByText('refresh')).toBeNull();
  });

  it('la aplicación no usa la rueda de carga del sistema (ActivityIndicator)', () => {
    const raiz = path.join(__dirname, '../../src');
    for (const archivo of archivos(raiz)) {
      expect({ archivo, usa: /ActivityIndicator/.test(fs.readFileSync(archivo, 'utf8')) }).toEqual({ archivo, usa: false });
    }
  });
});
