import fs from 'fs';
import path from 'path';
import tw, { Colors, esTema, setTema, tipografia } from '../../src/styles/styles';

const config = require('../../tailwind.config.js');

const luminancia = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a: string, b: string) => {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
};

describe('tema claro / oscuro', () => {
  afterEach(() => setTema('claro'));

  it('la paleta oscura tiene los mismos seis nombres que la clara', () => {
    expect(Object.keys(config.paletaOscura).sort()).toEqual(['beige', 'black', 'gray', 'red', 'silver', 'white']);
  });

  it('cambiar de tema cambia Colors y las clases de Tailwind a la vez', () => {
    expect(String(tw.style('bg-beige').backgroundColor)).toBe('#FAF8F2');
    setTema('oscuro');
    expect(Colors.beige).toBe(config.paletaOscura.beige);
    expect(String(tw.style('bg-beige').backgroundColor).toUpperCase()).toBe(config.paletaOscura.beige.toUpperCase());
    expect(String(tw.style('text-black').color).toUpperCase()).toBe(config.paletaOscura.black.toUpperCase());
    setTema('claro');
    expect(String(tw.style('bg-beige').backgroundColor)).toBe('#FAF8F2');
  });

  it('las tipografías registradas siguen el tema (no se calculan al importar)', () => {
    const clara = (tipografia.texto as any).color;
    setTema('oscuro');
    expect((tipografia.texto as any).color).not.toBe(clara);
  });

  it('en el tema oscuro el texto, el texto secundario y el rojo se leen sobre el fondo', () => {
    const p = config.paletaOscura;
    expect(contraste(p.black, p.beige)).toBeGreaterThan(7);
    expect(contraste(p.gray, p.beige)).toBeGreaterThan(4.5);
    expect(contraste(p.red, p.beige)).toBeGreaterThan(4.5);
    expect(contraste(p.white, p.black)).toBeGreaterThan(7);
  });

  it('esTema solo acepta claro y oscuro', () => {
    expect(esTema('claro')).toBe(true);
    expect(esTema('oscuro')).toBe(true);
    expect(esTema('sepia')).toBe(false);
  });

  it('todas las pantallas llaman a useTema() para volver a dibujarse al cambiar el tema', () => {
    const dir = path.join(process.cwd(), 'src', 'app');
    const sinHook = fs
      .readdirSync(dir)
      .filter((nombre) => nombre.endsWith('.tsx') && nombre !== '_layout.tsx')
      .filter((nombre) => !fs.readFileSync(path.join(dir, nombre), 'utf8').includes('useTema()'));
    expect(sinHook).toEqual([]);
  });

  it('todas las pantallas respetan la parte de abajo (botones de navegación del sistema): SafeAreaView con edges bottom', () => {
    const dir = path.join(process.cwd(), 'src');
    const archivos: string[] = [];
    const recorrer = (carpeta: string) => {
      for (const e of fs.readdirSync(carpeta, { withFileTypes: true })) {
        const ruta = path.join(carpeta, e.name);
        if (e.isDirectory()) recorrer(ruta);
        else if (/\.tsx$/.test(e.name)) archivos.push(ruta);
      }
    };
    recorrer(dir);
    const sinBottom = archivos.filter((ruta) =>
      [...fs.readFileSync(ruta, 'utf8').matchAll(/<SafeAreaView[^>]*edges=\{(\[[^\]]*\])\}/g)].some((m) => !m[1].includes("'bottom'"))
    );
    expect(sinBottom.map((r) => path.relative(dir, r))).toEqual([]);
  });

  it('el splash se fuerza a claro aunque el tema elegido sea el oscuro, y al soltarlo vuelve al elegido', () => {
    const { forzarTemaClaro } = require('../../src/styles/styles');
    setTema('oscuro');
    forzarTemaClaro(true);
    expect(Colors.beige).toBe('#FAF8F2');
    setTema('oscuro');
    expect(Colors.beige).toBe('#FAF8F2');
    forzarTemaClaro(false);
    expect(Colors.beige).toBe('#0F0F0F');
    setTema('claro');
  });
});

