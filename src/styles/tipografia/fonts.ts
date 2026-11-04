import { StyleProp, StyleSheet, TextStyle } from 'react-native';

export const FAMILIA_TITULO = 'PlayfairDisplay';

type TablaPesos = Record<number, string>;

const FUENTES_CUERPO: TablaPesos = {
  300: 'Inter_300Light',
  400: 'Inter_400Regular',
  500: 'Inter_500Medium',
  600: 'Inter_600SemiBold',
  700: 'Inter_700Bold',
};

const FUENTES_TITULO: TablaPesos = {
  400: 'PlayfairDisplay_400Regular_Italic',
};

let fuentesActivas = false;

export function activarFuentes(activas: boolean): void {
  fuentesActivas = activas;
}

function pesoNumerico(valor: unknown): number {
  if (valor === 'bold') return 700;
  if (valor === 'normal' || valor === undefined || valor === null) return 400;
  const n = Number(valor);
  return Number.isFinite(n) ? n : 400;
}

function pesoMasCercano(peso: number, tabla: TablaPesos): number {
  const disponibles = Object.keys(tabla).map(Number).sort((a, b) => a - b);
  return disponibles.reduce((mejor, actual) =>
    Math.abs(actual - peso) < Math.abs(mejor - peso) ? actual : mejor
  );
}

export function estiloConFuente(style: unknown): any {
  if (!fuentesActivas) return style;

  const plano = (StyleSheet.flatten(style as StyleProp<TextStyle>) ?? {}) as Record<string, any>;
  const peso = pesoNumerico(plano.fontWeight);

  let fuente: string;
  if (plano.fontFamily === undefined) {
    fuente = FUENTES_CUERPO[pesoMasCercano(peso, FUENTES_CUERPO)];
  } else if (plano.fontFamily === FAMILIA_TITULO) {
    fuente = FUENTES_TITULO[pesoMasCercano(peso, FUENTES_TITULO)];
  } else {
    return style;
  }

  return [style, { fontFamily: fuente, fontWeight: 'normal' }];
}
