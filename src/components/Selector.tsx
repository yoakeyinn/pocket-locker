import { useEffect, useState } from 'react';
import { Animated, Easing, TouchableOpacity, View } from 'react-native';
import { Text } from '../styles/tipografia/Tipografia';
import tw, { tipografia } from '../styles/styles';

const ANCHO_POR_DEFECTO = 84;
const ALTO = 32;
const MARGEN = 2;
const DURACION_MS = 420;

export interface OpcionSelector<T extends string> {
  valor: T;
  etiqueta: string;
}

export interface SelectorProps<T extends string> {
  opciones: [OpcionSelector<T>, OpcionSelector<T>];
  valor: T;
  onChange: (valor: T) => void;
  id: string;
  ancho?: number;
}

export function Selector<T extends string>({ opciones, valor, onChange, id, ancho = ANCHO_POR_DEFECTO }: SelectorProps<T>) {
  const ANCHO = ancho;
  const indice = opciones.findIndex((opcion) => opcion.valor === valor);
  const [posicion] = useState(() => new Animated.Value(indice));

  useEffect(() => {
    const movimiento = Animated.timing(posicion, {
      toValue: indice,
      duration: DURACION_MS,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    });
    movimiento.start();
    return () => movimiento.stop();
  }, [indice, posicion]);

  return (
    <View style={[tw`flex-row rounded-lg border border-silver bg-beige`, { padding: MARGEN }]}>
      <Animated.View
        testID={`${id}-indicador`}
        pointerEvents="none"
        style={[
          tw`absolute rounded-md bg-black`,
          {
            top: MARGEN,
            left: MARGEN,
            width: ANCHO,
            height: ALTO,
            transform: [
              { translateX: posicion.interpolate({ inputRange: [0, 1], outputRange: [0, ANCHO] }) },
              { scaleX: posicion.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.14, 1] }) },
            ],
          },
        ]}
      />
      {opciones.map((opcion, i) => {
        const seleccion = posicion.interpolate({ inputRange: [0, 1], outputRange: i === 0 ? [1, 0] : [0, 1] });
        const sinSeleccion = posicion.interpolate({ inputRange: [0, 1], outputRange: i === 0 ? [0, 1] : [1, 0] });
        return (
          <TouchableOpacity
            key={opcion.valor}
            testID={`${id}-${opcion.valor}`}
            accessibilityRole="button"
            accessibilityState={{ selected: opcion.valor === valor }}
            onPress={() => opcion.valor !== valor && onChange(opcion.valor)}
            activeOpacity={0.7}
            style={[tw`items-center justify-center`, { width: ANCHO, height: ALTO }]}
          >
            <Animated.View style={{ opacity: sinSeleccion }}>
              <Text style={[tipografia.anotacion, tw`text-xs`]}>{opcion.etiqueta}</Text>
            </Animated.View>
            <Animated.View style={[tw`absolute`, { opacity: seleccion }]}>
              <Text style={[tipografia.texto, tw`text-xs text-white`]}>{opcion.etiqueta}</Text>
            </Animated.View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
