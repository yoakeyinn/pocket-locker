import React from 'react';
import { StyleProp, TouchableOpacity, View, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Cargando } from './Cargando';
import { Text } from '../styles/tipografia/Tipografia';
import tw, { Colors, tipografia } from '../styles/styles';

export interface BotonProps {
  texto?: string;
  icono?: React.ComponentProps<typeof MaterialIcons>['name'];
  onPress: () => void;
  testID?: string;
  // relleno = negro con texto blanco (acción principal); sin relleno = solo borde negro
  relleno?: boolean;
  deshabilitado?: boolean;
  // sustituye el icono por la estrella de carga (búsqueda en curso)
  cargando?: boolean;
  // versión más baja para avisos y tarjetas
  compacto?: boolean;
  style?: StyleProp<ViewStyle>;
}

const TAMANO_ICONO = 18;

// Botón único de las pantallas: mismos bordes rectos y tipografía `texto` que los botones del Modal.
export const Boton: React.FC<BotonProps> = ({ texto, icono, onPress, testID, relleno, deshabilitado, cargando, compacto, style }) => {
  const colorContenido = relleno ? Colors.white : Colors.black;
  return (
    <TouchableOpacity
      testID={testID}
      style={[
        tw`flex-row items-center justify-center ${compacto ? 'px-4 py-2' : 'px-5 py-3'} rounded-lg border border-black ${relleno ? 'bg-black' : ''} ${
          deshabilitado ? 'opacity-60' : ''
        }`,
        style,
      ]}
      onPress={onPress}
      disabled={deshabilitado}
      activeOpacity={0.7}
    >
      {cargando ? (
        <Cargando tamano={TAMANO_ICONO} />
      ) : icono ? (
        <MaterialIcons name={icono} size={TAMANO_ICONO} color={colorContenido} />
      ) : null}
      {texto ? (
        <View style={cargando || icono ? tw`ml-2.5` : undefined}>
          <Text style={[tipografia.texto, relleno && tw`text-white`]}>{texto}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
};
