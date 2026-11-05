import { create } from 'zustand';
import es from './locales/es.json';
import en from './locales/en.json';

export type Idioma = 'es' | 'en';
export type ClaveLiteral = keyof typeof es;

const IDIOMAS: Record<Idioma, Record<string, string>> = { es, en };

const useIdiomaStore = create<{ idioma: Idioma }>(() => ({ idioma: 'es' }));

export const useIdioma = (): Idioma => useIdiomaStore((estado) => estado.idioma);

export const esIdioma = (valor: unknown): valor is Idioma => valor === 'es' || valor === 'en';

export function setIdioma(idioma: Idioma): void {
  useIdiomaStore.setState({ idioma });
}

export type ParametrosLiteral = Record<string, string | number>;

export function t(clave: ClaveLiteral, parametros?: ParametrosLiteral): string {
  const texto: string = IDIOMAS[useIdiomaStore.getState().idioma][clave] ?? es[clave] ?? clave;
  if (!parametros) return texto;
  return texto.replace(/\{\{(\w+)\}\}/g, (marcador, nombre) =>
    nombre in parametros ? String(parametros[nombre]) : marcador
  );
}
