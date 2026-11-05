import es from '../../../src/styles/i18n/locales/es.json';
import en from '../../../src/styles/i18n/locales/en.json';
import { setIdioma, t } from '../../../src/styles/i18n/index';

describe('i18n', () => {
  afterEach(() => setIdioma('es'));

  it('es.json y en.json tienen exactamente las mismas claves', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
  });

  it('ninguna clave está vacía', () => {
    for (const texto of [...Object.values(es), ...Object.values(en)]) {
      expect(texto.trim()).not.toBe('');
    }
  });

  it('cada clave usa los mismos marcadores {{x}} en español e inglés', () => {
    const marcadores = (texto: string) => (texto.match(/\{\{\w+\}\}/g) ?? []).sort();
    for (const clave of Object.keys(es) as (keyof typeof es)[]) {
      expect(marcadores(en[clave])).toEqual(marcadores(es[clave]));
    }
  });

  it('t() sustituye los marcadores por los parámetros', () => {
    const app = t('pl_app_titulo');
    expect(t('pl_buscar_ayuda', { app })).toBe(
      'Estos son los dispositivos Bluetooth que hemos encontrado a tu alrededor. Selecciona tu Pocket Locker en la lista para vincularlo con esta aplicación.'
    );
    setIdioma('en');
    expect(t('pl_buscar_ayuda', { app })).toBe(
      'These are the Bluetooth devices we have found around you. Select your Pocket Locker from the list to pair it with this app.'
    );
  });

  it('un marcador sin parámetro se deja visible en vez de romper el texto', () => {
    expect(t('pl_buscar_ayuda')).toContain('{{app}}');
    expect(t('pl_buscar_ayuda', {})).toContain('{{app}}');
  });

  it('t() devuelve el texto del idioma activo', () => {
    expect(t('pl_dispositivos_cercanos')).toBe('Dispositivos cercanos');
    setIdioma('en');
    expect(t('pl_dispositivos_cercanos')).toBe('Nearby devices');
    expect(t('pl_app_titulo')).toBe('Pocket Locker');
  });

  it('los textos que ve el usuario no mencionan herramientas ni términos de programación', () => {
    const prohibido = /expo|build|prebuild|metro|ESP32|dev client|desarrollo|development|debug|stack|excepci|exception/i;
    const infractores = (Object.entries(es) as [string, string][])
      .concat(Object.entries(en) as [string, string][])
      .filter(([, texto]) => prohibido.test(texto))
      .map(([clave]) => clave);
    expect([...new Set(infractores)]).toEqual([]);
  });

  it('en inglés se escribe «smartphone», nunca «phone» suelto', () => {
    const infractores = Object.entries(en as Record<string, string>)
      .filter(([, texto]) => /(?<![A-Za-z])phone(?![A-Za-z])/i.test(texto))
      .map(([clave]) => clave);
    expect(infractores).toEqual([]);
  });
});
