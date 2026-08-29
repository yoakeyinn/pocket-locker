import { useEffect, useRef, useCallback } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/Colors';
import { useBluetooth } from '../context/BluetoothContext';

/**
 * Pantalla de Confirmación de Resultado de la Operación.
 * Muestra una confirmación visual clara (ícono de éxito/error animado con muelle)
 * y emite una notificación háptica nativa para confirmar físicamente al usuario
 * que el comando fue enviado al microcontrolador.
 */
export default function ResultadoScreen() {
  const params = useLocalSearchParams<{ exito?: string; tipo?: string; mensajeError?: string }>();
  const exito = params.exito === 'true';
  const tipo = params.tipo === 'garaje' ? 'garaje' : 'peatonal';
  const mensajeError = params.mensajeError;
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animación de entrada estilo resorte elástico (Spring animation)
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 80,
      useNativeDriver: true,
    }).start();

    // Feedback háptico específico según el resultado
    if (exito) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  }, [scale, exito]);

  const onVolver = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/control');
    }
  }, []);

  const { desconectar } = useBluetooth();

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
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <MaterialIcons
            name={exito ? 'check-circle' : 'error'}
            size={80}
            color={exito ? Colors.exitoVerde : Colors.errorRojo}
          />
        </Animated.View>

        <Text style={styles.titulo}>
          {exito ? 'Comando enviado' : 'No se pudo abrir'}
        </Text>
        <Text style={styles.subtitulo}>
          {exito
            ? tituloOk
            : mensajeError || 'No se pudo enviar el comando. Verifica la conexión con el Pocket Locker.'}
        </Text>

        <View style={styles.botones}>
          <TouchableOpacity
            style={styles.botonPrimario}
            onPress={onVolver}
            activeOpacity={0.85}
          >
            <MaterialIcons name="arrow-back" size={20} color="#FFFFFF" />
            <Text style={styles.botonPrimarioTexto}>Volver</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.botonSalir}
            onPress={onDesconectar}
            activeOpacity={0.85}
          >
            <MaterialIcons name="link-off" size={20} color="#FFFFFF" />
            <Text style={styles.botonSalirTexto}>Desconectar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.beigeBg,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  titulo: {
    color: Colors.azulOscuro,
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
  },
  subtitulo: {
    color: Colors.textoSecundario,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  botones: {
    width: '100%',
    marginTop: 48,
    gap: 12,
  },
  botonPrimario: {
    flexDirection: 'row',
    backgroundColor: Colors.azulPrimario,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  botonPrimarioTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  botonSalir: {
    flexDirection: 'row',
    backgroundColor: Colors.errorRojo,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  botonSalirTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
