import React, { useEffect, useState } from 'react';
import { Animated, Easing, TouchableOpacity } from 'react-native';
import tw from '../styles/styles';

const ANCHO = 48;
const ALTO = 28;
const BOLA = 20;
const MARGEN = 3;
const DURACION_MS = 280;

export interface InterruptorProps {
  valor: boolean;
  onChange: (valor: boolean) => void;
  testID?: string;
}

export const Interruptor: React.FC<InterruptorProps> = ({ valor, onChange, testID }) => {
  const [posicion] = useState(() => new Animated.Value(valor ? 1 : 0));

  useEffect(() => {
    const movimiento = Animated.timing(posicion, {
      toValue: valor ? 1 : 0,
      duration: DURACION_MS,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    });
    movimiento.start();
    return () => movimiento.stop();
  }, [valor, posicion]);

  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: valor }}
      onPress={() => onChange(!valor)}
      activeOpacity={0.8}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[tw`rounded-full border border-silver bg-beige overflow-hidden`, { width: ANCHO, height: ALTO }]}
    >
      <Animated.View style={[tw`absolute inset-0 bg-black`, { opacity: posicion }]} />
      <Animated.View
        style={[
          tw`absolute rounded-full`,
          {
            top: (ALTO - BOLA) / 2 - 1,
            left: MARGEN,
            width: BOLA,
            height: BOLA,
            transform: [{ translateX: posicion.interpolate({ inputRange: [0, 1], outputRange: [0, ANCHO - BOLA - MARGEN * 2 - 2] }) }],
          },
        ]}
      >
        <Animated.View style={[tw`absolute inset-0 rounded-full bg-black`, { opacity: posicion.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]} />
        <Animated.View style={[tw`absolute inset-0 rounded-full bg-white`, { opacity: posicion }]} />
      </Animated.View>
    </TouchableOpacity>
  );
};
