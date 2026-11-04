import fs from 'fs';
import path from 'path';
import tw, { Colors } from '../../src/styles/styles';

const RAIZ = path.join(process.cwd(), 'src');

function archivos(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) archivos(p, acc);
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const fuentes = archivos(RAIZ).map((ruta) => ({ ruta, texto: fs.readFileSync(ruta, 'utf8') }));
const relativa = (ruta: string) => path.relative(RAIZ, ruta);

describe('paleta: black, white, beige, gray, silver y red', () => {
  it('no hay clases de color fuera de la paleta', () => {
    const prohibida =
      /(?<![\w-])(bg|text|border|shadow|ring)-(neutral|stone|slate|zinc|gray-\d|red-\d|blue|green|emerald|amber|orange|yellow|indigo|sky|purple|violet|azul|beige-|texto-secundario|rojo-oscuro|exito|error)/;
    expect(fuentes.filter(({ texto }) => prohibida.test(texto)).map(({ ruta }) => relativa(ruta))).toEqual([]);
  });

  it('toda clase de Tailwind usada existe (una clase de color fuera de la paleta no resolvería)', () => {
    const clase = /(?<![\w-])((?:bg|text|border|shadow|ring|divide|fill|stroke|outline)-[\w./]+)/g;
    const desconocidas = new Set<string>();
    for (const { ruta, texto } of fuentes) {
      for (const m of texto.matchAll(clase)) {
        if (Object.keys(tw.style(m[1])).length === 0) desconocidas.add(`${relativa(ruta)} ${m[1]}`);
      }
    }
    expect([...desconocidas]).toEqual([]);
  });

  it('no hay colores hexadecimales escritos a mano (se usa Colors)', () => {
    const fuera = new Set<string>();
    for (const { ruta, texto } of fuentes) {
      for (const m of texto.matchAll(/#[0-9A-Fa-f]{6}/g)) fuera.add(`${relativa(ruta)} ${m[0]}`);
    }
    expect([...fuera]).toEqual([]);
  });

  it('Colors coincide con lo que genera Tailwind', () => {
    const generado = (clase: string) => String(tw.style(clase).backgroundColor).toUpperCase();
    expect({
      black: generado('bg-black'),
      white: generado('bg-white'),
      beige: generado('bg-beige'),
      gray: generado('bg-gray'),
      silver: generado('bg-silver'),
      red: generado('bg-red'),
    }).toEqual(Object.fromEntries(Object.entries(Colors).map(([nombre, hex]) => [nombre, hex.toUpperCase()])));
  });

  it('el rojo es oscuro', () => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(Colors.red.slice(i, i + 2), 16));
    expect(r).toBeLessThan(160);
    expect(Math.max(g, b)).toBeLessThan(60);
  });
});
