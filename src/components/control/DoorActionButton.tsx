import React from 'react';
import { View, Text, TouchableOpacity, Animated, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import tw from '../../styles/tailwind';

/**
 * Propiedades del componente DoorActionButton.
 */
interface DoorActionButtonProps {
  /** Tipo de acceso controlado por este pulsador ('peatonal' o 'garaje') */
  tipo: 'peatonal' | 'garaje';
  /** Identifica qué acción está ejecutándose actualmente en segundo plano */
  ejecutando: 'peatonal' | 'garaje' | null;
  /** Segundos restantes en el margen de enfriamiento de 5 segundos */
  tiempoRestanteBloqueo: number;
  /** Si true, deshabilita visual y funcionalmente el botón táctil */
  botonDeshabilitado: boolean;
  /** Callback invocado al pulsar el botón */
  onPress: () => void;
  /** Callback al presionar (efecto resorte presionado) */
  onPressIn: () => void;
  /** Callback al liberar (efecto resorte liberado) */
  onPressOut: () => void;
  /** Valor animado nativo para la escala del botón al presionar */
  buttonPressScale: Animated.Value;
  /** Valor animado nativo para la pulsación suave durante el enfriamiento */
  cooldownAnim: Animated.Value;
  /** Valor animado nativo para la onda interior tipo sonar */
  pulseInner: Animated.Value;
  /** Valor animado nativo para la onda exterior tipo sonar */
  pulseOuter: Animated.Value;
}

/**
 * Pulsador circular táctil para el accionamiento de relés de puerta peatonal y portón de garaje.
 *
 * Características:
 * - Renderizado a 60 FPS nativos utilizando useNativeDriver en todas las interpolaciones de onda y escala.
 * - Soporte para estados de transmisión activa, cuenta atrás de enfriamiento (5s) y estado en espera.
 * - Estilizado exclusivamente con Tailwind CSS (twrnc) adaptado a los tokens de diseño de Pocket Locker.
 */
export const DoorActionButton: React.FC<DoorActionButtonProps> = ({
  tipo,
  ejecutando,
  tiempoRestanteBloqueo,
  botonDeshabilitado,
  onPress,
  onPressIn,
  onPressOut,
  buttonPressScale,
  cooldownAnim,
  pulseInner,
  pulseOuter,
}) => {
  const esPeatonal = tipo === 'peatonal';
  const esActivo = ejecutando === tipo;
  const enCooldown = tiempoRestanteBloqueo > 0;
  const testID = esPeatonal ? 'btn-peatonal' : 'btn-garaje';

  const tituloCard = esPeatonal ? 'Puerta Peatonal' : 'Portón de Garaje';
  const descCard = esPeatonal
    ? 'Puerta de entrada peatonal del edificio'
    : 'Acceso rodado para vehículos';
  const iconoNombre = esPeatonal ? 'door-front' : 'garage';

  let estadoTexto = 'PULSAR PARA ABRIR';
  let estadoSubtexto = 'Pulso de 5 segundos';

  if (esActivo) {
    estadoTexto = esPeatonal ? 'ABRIENDO PUERTA...' : 'ABRIENDO PORTÓN...';
    estadoSubtexto = 'Comando seguro transmitido';
  } else if (enCooldown) {
    estadoTexto = `Espera ${tiempoRestanteBloqueo} s...`;
    estadoSubtexto = 'Protección anti-colisión activa';
  }

  return (
    <View style={tw`bg-beige-card rounded-3xl p-6 shadow-md border border-stone-200/60 w-full`}>
      {/* Cabecera de la tarjeta */}
      <View style={tw`flex-row items-center mb-8`}>
        <View style={tw`w-12 h-12 rounded-2xl bg-azul-claro items-center justify-center mr-3.5`}>
          <MaterialIcons name={iconoNombre} size={26} color="#2C5F8A" />
        </View>
        <View style={tw`flex-1`}>
          <Text style={tw`text-lg font-bold text-azul-oscuro`}>{tituloCard}</Text>
          <Text style={tw`text-xs text-texto-secundario mt-0.5`}>{descCard}</Text>
        </View>
      </View>

      {/* Área del pulsador circular con animaciones */}
      <View style={tw`items-center justify-center py-6`}>
        {esActivo && (
          <>
            <Animated.View
              style={[
                tw`w-64 h-64 rounded-full absolute bg-azul-primario/10`,
                {
                  transform: [{ scale: pulseOuter }],
                  opacity: pulseOuter.interpolate({
                    inputRange: [1, 1.5],
                    outputRange: [0.6, 0],
                  }),
                },
              ]}
            />
            <Animated.View
              style={[
                tw`w-52 h-52 rounded-full absolute bg-azul-primario/20`,
                {
                  transform: [{ scale: pulseInner }],
                  opacity: pulseInner.interpolate({
                    inputRange: [1, 1.25],
                    outputRange: [0.8, 0.1],
                  }),
                },
              ]}
            />
          </>
        )}

        <Animated.View
          style={[
            tw`items-center justify-center`,
            {
              transform: [
                { scale: buttonPressScale },
                { scale: enCooldown ? cooldownAnim : 1 },
              ],
            },
          ]}
        >
          <TouchableOpacity
            testID={testID}
            style={tw`w-44 h-44 rounded-full items-center justify-center shadow-xl border-4 ${
              botonDeshabilitado
                ? 'bg-stone-300 border-stone-200'
                : 'bg-azul-primario border-blue-400/40'
            }`}
            onPress={botonDeshabilitado ? undefined : onPress}
            onPressIn={botonDeshabilitado ? undefined : onPressIn}
            onPressOut={botonDeshabilitado ? undefined : onPressOut}
            disabled={botonDeshabilitado}
            activeOpacity={0.85}
          >
            {esActivo ? (
              <View style={tw`items-center justify-center`}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={tw`text-white font-bold text-xs mt-3 uppercase tracking-wider`}>
                  Enviando...
                </Text>
              </View>
            ) : enCooldown ? (
              <View style={tw`items-center justify-center`}>
                <MaterialIcons name="timer" size={44} color="#6B6B6B" />
                <Text style={tw`text-texto-secundario font-extrabold text-2xl mt-1`}>
                  {tiempoRestanteBloqueo}s
                </Text>
              </View>
            ) : (
              <View style={tw`items-center justify-center`}>
                <MaterialIcons name={iconoNombre} size={54} color="#FFFFFF" />
                <Text style={tw`text-white font-extrabold text-xs mt-2 uppercase tracking-widest`}>
                  Abrir
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Indicador de estado y subtítulo */}
      <View style={tw`items-center mt-4`}>
        <Text
          style={tw`text-sm font-extrabold tracking-wide uppercase ${
            esActivo ? 'text-azul-primario' : enCooldown ? 'text-texto-secundario' : 'text-azul-oscuro'
          }`}
        >
          {estadoTexto}
        </Text>
        <Text style={tw`text-xs text-texto-secundario mt-1`}>{estadoSubtexto}</Text>
      </View>
    </View>
  );
};

export default DoorActionButton;
