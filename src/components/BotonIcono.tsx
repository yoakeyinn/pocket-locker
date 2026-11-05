import React from 'react';
import { TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import tw, { Colors } from '../styles/styles';

export interface BotonIconoProps {
  icono: React.ComponentProps<typeof MaterialIcons>['name'];
  onPress?: () => void;
  testID?: string;
  conBoton?: boolean;
}

export const ANCHO_BOTON_ICONO = 60;

export const BotonIcono: React.FC<BotonIconoProps> = ({ icono, onPress, testID, conBoton }) => (
  <TouchableOpacity
    testID={testID}
    onPress={onPress}
    style={tw`items-center justify-center bg-white border ${conBoton ? 'px-5 py-3 rounded-lg border-silver' : 'w-10 h-10 rounded-xl shadow-sm border-silver'}`}
    activeOpacity={0.7}
  >
    <MaterialIcons name={icono} size={conBoton ? 18 : 22} color={Colors.black} />
  </TouchableOpacity>
);
