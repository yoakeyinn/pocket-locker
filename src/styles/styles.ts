import { Animated, Easing, StyleSheet } from 'react-native';
import { create } from 'twrnc';

// =============================================================================
// GLOBAL
// =============================================================================

// La paleta se define una sola vez, en tailwind.config.js; aquí se lee para los props de color.
const { transparent, ...paleta } = require('../../tailwind.config.js').theme.colors;
export const Colors = paleta as Record<'black' | 'white' | 'beige' | 'gray' | 'silver' | 'red', string>;

export const APP_VERSION: string = require('../../package.json').version;

export const tw = create(require('../../tailwind.config.js'));
export default tw;

const TEXTO_BASE = 'text-sm font-light tracking-widest';

export const tipografia = {
  titulo: tw`font-display font-bold text-black`,
  texto: tw`${TEXTO_BASE} text-black`,
  anotacion: tw`${TEXTO_BASE} text-gray`,
  error: tw`text-[11px] font-light tracking-wide text-red text-right`,
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

// SPLASH

export const ESTRELLAS = Array.from({ length: 6 }, (_, i) => i + 1);
const ESTRELLA_TAMANO = 24;
export const ESTRELLA_APAGADA = Colors.silver;
export const ESTRELLA_ENCENDIDA = Colors.black;

// Tramo de progreso en el que se enciende cada estrella (≈0,45 s con 3 s de carga)
const ESTRELLA_FUNDIDO = 0.15;
const ENTRADA_MS = 2000;
const SUBIDA_PX = 18;
const TAGLINE_OPACIDAD = 0.6;

export const splashEstilos = StyleSheet.create({
  pantalla: tw`flex-1 items-center justify-center bg-beige`,
  tituloCaja: tw`self-stretch`,
  titulo: tw`text-center px-4 font-display text-black mt-4 uppercase`,
  tagline: tw`mt-2`,
  barra: tw`flex-row`,
  encima: tw`absolute`,
  versionCaja: tw`absolute bottom-6 items-center`,
  version: tw`text-xs font-light text-gray opacity-60 tracking-widest`,
});

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
