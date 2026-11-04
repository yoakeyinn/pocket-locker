import fs from 'fs';
import path from 'path';
import { ANIMACION_MODAL } from '../../src/components/Modal';

const RAIZ = path.join(process.cwd(), 'src');

function archivos(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) archivos(ruta, acc);
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(ruta);
  }
  return acc;
}

const fuentes = archivos(RAIZ).map((ruta) => ({ ruta: path.relative(RAIZ, ruta), texto: fs.readFileSync(ruta, 'utf8') }));

describe('todos los modales comparten el mismo estilo y animación', () => {
  it('la animación de entrada es la aprobada (suave, 700 ms)', () => {
    expect(ANIMACION_MODAL).toEqual({ retrasoMs: 120, duracionMs: 700, subidaPx: 10, escalaInicial: 0.97 });
  });

  it('nadie usa Alert.alert: todo pasa por mostrarModal', () => {
    expect(fuentes.filter(({ texto }) => /Alert\.alert\(/.test(texto)).map(({ ruta }) => ruta)).toEqual([]);
  });

  it('el Modal de react-native solo se usa dentro de components/Modal.tsx', () => {
    const importaModalNativo = /import\s*\{[^}]*\bModal\b[^}]*\}\s*from\s*'react-native'/;
    const fuera = fuentes.filter(({ ruta, texto }) => ruta !== path.join('components', 'Modal.tsx') && importaModalNativo.test(texto));
    expect(fuera.map(({ ruta }) => ruta)).toEqual([]);
  });
});
