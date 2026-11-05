import React, { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { Estrella } from './Estrella';
import { Colors } from '../styles/styles';

export const GIRO_CARGANDO_MS = 8000;

export interface CargandoProps {
  tamano?: number;
  color?: string;
}

export const Cargando: React.FC<CargandoProps> = ({ tamano = 24, color = Colors.silver }) => {
  const [giro] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const vuelta = Animated.loop(
      Animated.timing(giro, { toValue: 1, duration: GIRO_CARGANDO_MS, easing: Easing.linear, useNativeDriver: true })
    );
    vuelta.start();
    return () => vuelta.stop();
  }, [giro]);

  return (
    <Animated.View
      testID="cargando"
      accessibilityRole="progressbar"
      style={{ transform: [{ rotate: giro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}
    >
      <Estrella tamano={tamano} color={color} />
    </Animated.View>
  );
};
