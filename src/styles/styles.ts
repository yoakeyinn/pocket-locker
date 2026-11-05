import { Animated, Easing } from 'react-native';
import { create } from 'twrnc';
import { create as crearStore } from 'zustand';

const config = require('../../tailwind.config.js');
const { transparent, ...paletaClara } = config.theme.colors;

type Paleta = Record<'black' | 'white' | 'beige' | 'gray' | 'silver' | 'red', string>;
export type Tema = 'claro' | 'oscuro';

const PALETAS: Record<Tema, Paleta> = { claro: paletaClara, oscuro: config.paletaOscura };
const INSTANCIAS: Record<Tema, ReturnType<typeof create>> = {
  claro: create(config),
  oscuro: create({ ...config, theme: { ...config.theme, colors: { transparent, ...PALETAS.oscuro } } }),
};

export const Colors: Paleta = { ...PALETAS.claro };

export const APP_VERSION: string = require('../../package.json').version;

let temaActual: Tema = 'claro';
let temaElegido: Tema = 'claro';
let claroForzado = false;
const useTemaStore = crearStore<{ tema: Tema }>(() => ({ tema: 'claro' }));

export const useTema = (): Tema => useTemaStore((estado) => estado.tema);
export const esTema = (valor: unknown): valor is Tema => valor === 'claro' || valor === 'oscuro';

function aplicarTema(): void {
  temaActual = claroForzado ? 'claro' : temaElegido;
  Object.assign(Colors, PALETAS[temaActual]);
  useTemaStore.setState({ tema: temaActual });
}

export function setTema(tema: Tema): void {
  temaElegido = tema;
  aplicarTema();
}

export function forzarTemaClaro(forzar: boolean): void {
  claroForzado = forzar;
  aplicarTema();
}

export const tw = Object.assign((...args: unknown[]) => (INSTANCIAS[temaActual] as any)(...args), {
  style: (...args: unknown[]) => (INSTANCIAS[temaActual] as any).style(...args),
  color: (...args: unknown[]) => (INSTANCIAS[temaActual] as any).color(...args),
}) as unknown as ReturnType<typeof create>;
export default tw;

const TEXTO_BASE = 'text-sm font-light tracking-widest';

export const tipografia = {
  get titulo() {
    return tw`font-display font-bold text-black`;
  },
  get texto() {
    return tw`${TEXTO_BASE} text-black`;
  },
  get anotacion() {
    return tw`${TEXTO_BASE} text-gray`;
  },
  get error() {
    return tw`text-[11px] font-light tracking-wide text-red text-right`;
  },
};

export const cicloPulso = (
  pulso: Animated.Value,
  opacidad: Animated.Value,
  { escala, opacidadInicial, duracion, retraso = 0 }: { escala: number; opacidadInicial: number; duracion: number; retraso?: number }
) =>
  Animated.sequence([
    Animated.delay(retraso),
    Animated.parallel([
      Animated.timing(pulso, { toValue: escala, duration: duracion, useNativeDriver: true }),
      Animated.timing(opacidad, { toValue: 0, duration: duracion, useNativeDriver: true }),
    ]),
    Animated.timing(pulso, { toValue: 1, duration: 0, useNativeDriver: true }),
    Animated.timing(opacidad, { toValue: opacidadInicial, duration: 0, useNativeDriver: true }),
  ]);

export const ESTRELLAS = Array.from({ length: 6 }, (_, i) => i + 1);
const ESTRELLA_TAMANO = 24;

const ESTRELLA_FUNDIDO = 0.15;
const ENTRADA_MS = 600;
const SUBIDA_PX = 18;
const TAGLINE_OPACIDAD = 0.6;

export const splashEstilos = {
  get pantalla() {
    return tw`flex-1 items-center justify-center bg-beige`;
  },
  get tituloCaja() {
    return tw`self-stretch`;
  },
  get titulo() {
    return tw`text-center px-4 font-display text-black mt-4 uppercase`;
  },
  get tagline() {
    return tw`mt-2`;
  },
  get barra() {
    return tw`flex-row`;
  },
  get encima() {
    return tw`absolute`;
  },
  get versionCaja() {
    return tw`absolute items-center`;
  },
  get version() {
    return tw`text-xs font-light text-gray opacity-60 tracking-widest`;
  },
};

export const splashMedidas = (ancho: number, alto: number) => {
  const k = Math.min(1.35, Math.max(0.8, Math.min(ancho / 390, alto / 800)));
  const px = (base: number) => Math.round(base * k);
  return {
    icono: px(176),
    titulo: px(27),
    espaciadoTitulo: px(27) * 0.05,
    tagline: px(14),
    espaciadoTagline: px(14) * 0.1,
    estrella: px(ESTRELLA_TAMANO),
    margenEstrella: px(6),
    separacionBarra: px(48),
  };
};

const subir = (v: Animated.Value, opacidadFinal = 1) => ({
  opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, opacidadFinal] }),
  transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [SUBIDA_PX, 0] }) }],
});

export const splashAnimacion = {
  entrar: (v: Animated.Value) =>
    Animated.timing(v, { toValue: 1, duration: ENTRADA_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
  icono: (v: Animated.Value) => ({
    opacity: v,
    transform: [{ scale: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.8, 1.04, 1] }) }],
  }),
  titulo: (v: Animated.Value) => subir(v),
  tagline: (v: Animated.Value) => subir(v, TAGLINE_OPACIDAD),
  estrella: (progreso: Animated.Value, n: number) => ({
    opacity: progreso.interpolate({
      inputRange: [n / ESTRELLAS.length - ESTRELLA_FUNDIDO, n / ESTRELLAS.length],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
  }),
};
