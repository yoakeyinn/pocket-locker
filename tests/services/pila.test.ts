import { compactarPila } from '../../src/services/pila';

const URL_METRO =
  'http://192.168.1.129:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=host.exp.exponent&hot=false';

const PILA = [
  'Invariant Violation: algo falló',
  `    at invariant (${URL_METRO}:5920:26)`,
  `    at getEnforcing (${URL_METRO}:5883:27)`,
  `    at loadModuleImplementation (${URL_METRO}:319:16)`,
  `    at guardedLoadModule (${URL_METRO}:215:38)`,
  `    at ?anon_0_cerrarAplicacion (${URL_METRO}:186154:14)`,
  '    at next (native)',
  '    at anonymous (address at InternalBytecode.js:1:42127)',
  ...Array.from({ length: 50 }, (_, i) => `    at recursivelyTraversePassiveMountEffects (${URL_METRO}:${26000 + i}:34)`),
  '    ... skipping 283 frames',
  `    at miFuncion (${URL_METRO}:100:5)`,
].join('\n');

describe('compactarPila', () => {
  it('quita las URL del servidor de desarrollo y deja solo función y posición', () => {
    const resultado = compactarPila(PILA);
    expect(resultado).not.toContain('http');
    expect(resultado).not.toContain('platform=android');
    expect(resultado).toContain('at invariant (5920:26)');
  });

  it('descarta el ruido de React, Metro y Hermes', () => {
    const resultado = compactarPila(PILA);
    expect(resultado).not.toMatch(/recursivelyTraverse|loadModuleImplementation|guardedLoadModule|InternalBytecode|native|skipping/);
  });

  it('no repite la primera línea (el mensaje) y se queda con los frames útiles', () => {
    const resultado = compactarPila(PILA, 10);
    expect(resultado).not.toContain('Invariant Violation');
    expect(resultado.split('\n')).toEqual([
      'at invariant (5920:26)',
      'at getEnforcing (5883:27)',
      'at ?anon_0_cerrarAplicacion (186154:14)',
      'at miFuncion (100:5)',
    ]);
  });

  it('corta en el máximo indicando cuántos frames sobran', () => {
    const resultado = compactarPila(PILA, 2).split('\n');
    expect(resultado).toHaveLength(3);
    expect(resultado[2]).toBe('… (+2 más)');
  });

  it('una pila vacía o ausente da texto vacío', () => {
    expect(compactarPila(undefined)).toBe('');
    expect(compactarPila('')).toBe('');
  });
});
