import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';

const ANCHO_GLIFO = 1.125;

export interface EstrellaProps {
  tamano: number;
  color: string;
  contorno?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const Estrella: React.FC<EstrellaProps> = ({ tamano, color, contorno = false, style }) => (
  <View style={[{ width: tamano, height: tamano, alignItems: 'center', justifyContent: 'center' }, style]}>
    <FontAwesome6
      name="star"
      solid={!contorno}
      size={tamano / ANCHO_GLIFO}
      color={color}
      style={{ textAlign: 'center', includeFontPadding: false }}
    />
  </View>
);
