import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useBluetooth } from '../services/BluetoothService';
import tw, { APP_VERSION } from '../styles';

/**
 * Pantalla de Carga y Bienvenida (Splash Screen).
 */
export default function SplashScreen() {
  const { cargando, deviceMac, userName } = useBluetooth();
  const opacity = useRef(new Animated.Value(1)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 1000, useNativeDriver: false }).start(() => {
      setMinTimeElapsed(true);
    });
  }, [progress]);

  useEffect(() => {
    if (!cargando && minTimeElapsed) {
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        if (!userName) {
          router.replace('/nombre');
        } else {
          router.replace(deviceMac ? '/control' : '/inicio');
        }
      });
    }
  }, [cargando, minTimeElapsed, opacity, deviceMac, userName]);

  return (
    <Animated.View style={[tw`flex-1 items-center justify-center bg-beige-bg`, { opacity }]}>
      <View style={tw`w-28 h-28 rounded-3xl bg-azul-claro items-center justify-center shadow-sm mb-2`}>
        <MaterialIcons name="lock" size={64} color="#2C5F8A" />
      </View>
      <Text style={tw`text-2xl font-black text-azul-oscuro mt-4 tracking-widest uppercase`}>
        Pocket Locker
      </Text>
      <Text style={tw`text-sm font-semibold text-texto-secundario mt-1 tracking-wide`}>
        Control de acceso seguro
      </Text>

      <View style={tw`w-2/3 h-2 bg-stone-200 rounded-full mt-12 overflow-hidden shadow-inner`}>
        <Animated.View
          style={[
            tw`h-full bg-azul-primario rounded-full`,
            {
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      <View style={tw`absolute bottom-8 items-center`}>
        <Text style={tw`text-xs text-stone-400/80 font-medium tracking-widest`}>v{APP_VERSION}</Text>
      </View>
    </Animated.View>
  );
}
