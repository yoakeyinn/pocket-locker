import React from 'react';
import { TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import tw, { Colors } from '../styles/styles';

export interface BotonIconoProps {
  icono: React.ComponentProps<typeof MaterialIcons>['name'];
  onPress?: () => void;
  testID?: string;
}

export const BotonIcono: React.FC<BotonIconoProps> = ({ icono, onPress, testID }) => (
  <TouchableOpacity
    testID={testID}
    onPress={onPress}
    style={tw`w-10 h-10 items-center justify-center rounded-xl bg-white shadow-sm border border-silver`}
    activeOpacity={0.7}
  >
    <MaterialIcons name={icono} size={22} color={Colors.black} />
  </TouchableOpacity>
);
