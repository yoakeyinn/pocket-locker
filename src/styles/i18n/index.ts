import es from './locales/es.json';
import en from './locales/en.json';

export type Idioma = 'es' | 'en';
export type ClaveLiteral = keyof typeof es;

const IDIOMAS: Record<Idioma, Record<string, string>> = { es, en };

let idiomaActual: Idioma = 'es';

export function setIdioma(idioma: Idioma): void {
  idiomaActual = idioma;
}

export type ParametrosLiteral = Record<string, string | number>;

export function t(clave: ClaveLiteral, parametros?: ParametrosLiteral): string {
  const texto: string = IDIOMAS[idiomaActual][clave] ?? es[clave] ?? clave;
  if (!parametros) return texto;
  return texto.replace(/\{\{(\w+)\}\}/g, (marcador, nombre) =>
    nombre in parametros ? String(parametros[nombre]) : marcador
  );
}
