import React from 'react';
import { View, TouchableOpacity, Animated, useWindowDimensions } from 'react-native';
import { Cargando } from '../Cargando';
import { FontAwesome5 } from '@expo/vector-icons';
import tw, { Colors } from '../../styles/styles';
import { Puerta } from '../../services/comun';

export interface DoorActionButtonProps {
  tipo: Puerta;
  ejecutando: Puerta | null;
  tiempoRestanteBloqueo: number;
  botonDeshabilitado: boolean;
  onPress: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  buttonPressScale: Animated.Value;
  radarPulse1: Animated.Value;
  radarPulse2: Animated.Value;
  radarOpacity1: Animated.Value;
  radarOpacity2: Animated.Value;
}

export const DoorActionButton: React.FC<DoorActionButtonProps> = ({
  tipo,
  ejecutando,
  tiempoRestanteBloqueo,
  botonDeshabilitado,
  onPress,
  onPressIn,
  onPressOut,
  buttonPressScale,
  radarPulse1,
  radarPulse2,
  radarOpacity1,
  radarOpacity2,
}) => {
  const { width, height } = useWindowDimensions();
  const area = Math.max(160, Math.min(288, width - 64, height * 0.4));
  const escala = area / 288;
  const diametroBoton = Math.round(176 * escala);
  const diametroOnda = Math.round(208 * escala);
  const esPeatonal = tipo === 'peatonal';
  const esActivo = ejecutando === tipo;
  const enCooldown = tiempoRestanteBloqueo > 0;

  const ondaClase = (capa: 1 | 2) =>
    esActivo
      ? capa === 1 ? 'bg-gray/25 border border-gray/40' : 'bg-gray/30 border border-gray/50'
      : capa === 1 ? 'bg-gray/15 border border-gray/30' : 'bg-gray/20 border border-gray/35';

  const btnStyle = enCooldown
    ? 'bg-silver border-silver shadow-none'
    : esPeatonal
    ? esActivo ? 'bg-gray border-silver' : 'bg-black border-gray/80'
    : esActivo ? 'bg-gray border-gray' : 'bg-gray border-gray/80';

  return (
    <View style={tw`items-center justify-center w-full py-2`}>
      <View style={[tw`items-center justify-center relative`, { width: area, height: area }]}>
        <Animated.View
          pointerEvents="none"
          style={[
            tw`rounded-full absolute ${ondaClase(1)}`,
            { width: diametroOnda, height: diametroOnda, transform: [{ scale: radarPulse1 }], opacity: radarOpacity1 },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            tw`rounded-full absolute ${ondaClase(2)}`,
            { width: diametroOnda, height: diametroOnda, transform: [{ scale: radarPulse2 }], opacity: radarOpacity2 },
          ]}
        />

        <Animated.View
          style={[
            tw`rounded-full items-center justify-center shadow-xl`,
            { width: diametroBoton, height: diametroBoton, transform: [{ scale: buttonPressScale }] },
          ]}
        >
          <TouchableOpacity
            testID={esPeatonal ? 'btn-peatonal' : 'btn-garaje'}
            onPress={onPress}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            disabled={botonDeshabilitado}
            activeOpacity={1}
            delayPressIn={0}
            style={tw`w-full h-full rounded-full items-center justify-center border-4 ${btnStyle}`}
          >
            {esActivo ? (
              <Cargando tamano={Math.round(56 * escala)} />
            ) : esPeatonal ? (
              <FontAwesome5 name="walking" size={Math.round(62 * escala)} color={Colors.white} style={tw`ml-1`} />
            ) : (
              <FontAwesome5 name="car-side" size={Math.round(56 * escala)} color={Colors.white} />
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

    </View>
  );
};
