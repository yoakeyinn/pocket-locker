import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';
import { splashAnimacion } from '../styles/styles';

const APARICION = { duracionMs: 700, pasoMs: 90, maximoEscalones: 6 };

export const ENTRADA_LENTA_MS = 1300;
export const PASO_ENTRADA_MS = 450;

export interface ApareceProps {
  retraso?: number;
  duracion?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export const Aparece: React.FC<ApareceProps> = ({ retraso = 0, duracion = APARICION.duracionMs, style, children }) => {
  const [valor] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const entrada = Animated.sequence([
      Animated.delay(retraso),
      Animated.timing(valor, {
        toValue: 1,
        duration: duracion,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    entrada.start();
    return () => entrada.stop();
  }, [valor, retraso, duracion]);

  return <Animated.View style={[style, splashAnimacion.titulo(valor)]}>{children}</Animated.View>;
};

export const retrasoEscalonado = (indice: number, base = 0, paso = APARICION.pasoMs) =>
  base + Math.min(indice, APARICION.maximoEscalones) * paso;
