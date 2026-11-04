import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';
import { splashAnimacion } from '../styles/styles';

const APARICION = { duracionMs: 700, pasoMs: 90, maximoEscalones: 6 };

export interface ApareceProps {
  retraso?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

// Entrada suave (fundido + subida) como la del splash y la de la pantalla de búsqueda.
export const Aparece: React.FC<ApareceProps> = ({ retraso = 0, style, children }) => {
  const [valor] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const entrada = Animated.sequence([
      Animated.delay(retraso),
      Animated.timing(valor, {
        toValue: 1,
        duration: APARICION.duracionMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    entrada.start();
    return () => entrada.stop();
  }, [valor, retraso]);

  return <Animated.View style={[style, splashAnimacion.titulo(valor)]}>{children}</Animated.View>;
};

// Retraso escalonado para elementos de una lista (los primeros se encadenan, el resto entra a la vez).
export const retrasoEscalonado = (indice: number, base = 0) =>
  base + Math.min(indice, APARICION.maximoEscalones) * APARICION.pasoMs;
