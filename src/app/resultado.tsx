import React, { useEffect, useRef, useCallback } from 'react';
import {
  Animated,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useBluetooth } from '../context/BluetoothContext';
import tw from '../styles/tailwind';

/**
 * Pantalla de Confirmación de Resultado de la Operación.
 * Muestra una confirmación visual clara con animaciones de resorte elástico
 * y feedback háptico nativo, estilizado exclusivamente con Tailwind CSS.
 */
export default function ResultadoScreen() {
  const params = useLocalSearchParams<{ exito?: string; tipo?: string; mensajeError?: string }>();
  const exito = params.exito === 'true';
  const tipo = params.tipo === 'garaje' ? 'garaje' : 'peatonal';
  const mensajeError = params.mensajeError;
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 80,
      useNativeDriver: true,
    }).start();

    if (exito) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  }, [scale, exito]);

  /** Regresa a la pantalla de control o retrocede en la pila de navegación */
  const onVolver = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/control');
    }
  }, []);

  const { desconectar } = useBluetooth();

  /** Desconecta la sesión Bluetooth actual y vuelve a la pantalla de inicio */
  const onDesconectar = useCallback(async () => {
    try {
      await desconectar();
    } catch {
      // Ignorar posibles fallos al desconectar
    }
    router.replace('/(tabs)');
  }, [desconectar]);

  const tituloOk =
    tipo === 'garaje' ? 'El portón debería abrirse' : 'La puerta debería abrirse';

  return (
    <SafeAreaView style={tw`flex-1 bg-beige-bg`} edges={['top', 'bottom']}>
      <View style={tw`flex-1 items-center justify-center px-8`}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <MaterialIcons
            name={exito ? 'check-circle' : 'error'}
            size={84}
            color={exito ? '#49A241' : '#E85D5D'}
          />
        </Animated.View>

        <Text style={tw`text-2xl font-bold text-azul-oscuro mt-5 text-center`}>
          {exito ? 'Comando enviado' : 'No se pudo abrir'}
        </Text>
        <Text style={tw`text-sm text-texto-secundario mt-2 text-center leading-5 px-2`}>
          {exito
            ? tituloOk
            : mensajeError || 'No se pudo enviar el comando. Verifica la conexión con el Pocket Locker.'}
        </Text>

        <View style={tw`w-full mt-12 gap-3.5`}>
          <TouchableOpacity
            style={tw`flex-row items-center justify-center py-4 rounded-xl bg-azul-primario shadow-md`}
            onPress={onVolver}
            activeOpacity={0.85}
          >
            <MaterialIcons name="arrow-back" size={20} color="#FFFFFF" />
            <Text style={tw`text-white font-bold text-base ml-2`}>Volver</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={tw`flex-row items-center justify-center py-4 rounded-xl bg-error-rojo shadow-sm`}
            onPress={onDesconectar}
            activeOpacity={0.85}
          >
            <MaterialIcons name="link-off" size={20} color="#FFFFFF" />
            <Text style={tw`text-white font-bold text-base ml-2`}>Desconectar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
