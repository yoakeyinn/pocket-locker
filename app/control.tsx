import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/Colors';
import { useBluetooth } from '../context/BluetoothContext';

export default function ControlScreen() {
  const {
    status,
    deviceName,
    conectar,
    enviarComando,
    modoSimulacion,
    setModoSimulacion,
  } = useBluetooth();

  const [ejecutando, setEjecutando] = useState<'peatonal' | 'garaje' | null>(null);
  const pulsePeatonal = useRef(new Animated.Value(1)).current;
  const pulseGaraje = useRef(new Animated.Value(1)).current;
  const blinkValue = useRef(new Animated.Value(1)).current;

  // Animación de parpadeo al conectar
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (status === 'connecting') {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(blinkValue, {
            toValue: 0.25,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(blinkValue, {
            toValue: 1.0,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    } else {
      blinkValue.setValue(1.0);
    }
    return () => {
      if (animation) {
        animation.stop();
      }
    };
  }, [status, blinkValue]);

  // Animación de pulso para la puerta peatonal cuando está activa
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (status === 'connected' && ejecutando === 'peatonal') {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulsePeatonal, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulsePeatonal, {
            toValue: 1.0,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    } else {
      pulsePeatonal.setValue(1.0);
    }
    return () => {
      if (animation) animation.stop();
    };
  }, [status, ejecutando, pulsePeatonal]);

  // Animación de pulso para el garaje cuando está activo
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (status === 'connected' && ejecutando === 'garaje') {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseGaraje, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseGaraje, {
            toValue: 1.0,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    } else {
      pulseGaraje.setValue(1.0);
    }
    return () => {
      if (animation) animation.stop();
    };
  }, [status, ejecutando, pulseGaraje]);

  const handleAbrir = useCallback(async (tipo: 'peatonal' | 'garaje', comando: string) => {
    if (ejecutando) return;
    Haptics.selectionAsync().catch(() => {});
    setEjecutando(tipo);

    try {
      if (status === 'unpaired') {
        Alert.alert(
          'Sin dispositivo',
          'No hay un dispositivo vinculado. Vincula uno primero.',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Vincular',
              onPress: () => router.replace('/(tabs)'),
            },
          ]
        );
        return;
      }

      if (status === 'disabled') {
        Alert.alert('Bluetooth apagado', 'Activa el Bluetooth para continuar');
        return;
      }

      if (status === 'unauthorized') {
        Alert.alert(
          'Sin permisos',
          'Concede permisos de Bluetooth a la aplicación en los ajustes.'
        );
        return;
      }

      // Si está desconectado, intentamos conectar primero
      if (status !== 'connected') {
        try {
          await conectar();
        } catch {
          Alert.alert(
            'Error de conexión',
            'No se pudo conectar con el dispositivo. Verifica que esté encendido y cerca.'
          );
          return;
        }
      }

      // Enviar el comando
      if (__DEV__) {
        console.warn(`[DEBUG ARDUINO] Enviando el comando exacto: "${comando}"`);
      }
      try {
        await enviarComando(comando);
        router.push(`/resultado?exito=true&tipo=${tipo}`);
      } catch {
        router.push(`/resultado?exito=false&tipo=${tipo}`);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Ocurrió un error inesperado');
    } finally {
      setEjecutando(null);
    }
  }, [ejecutando, status, conectar, enviarComando]);

  const onVolver = useCallback(() => {
    router.replace('/(tabs)');
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {modoSimulacion && (
        <TouchableOpacity
          onPress={() => setModoSimulacion(false)}
          style={styles.bannerSimulacion}
          activeOpacity={0.9}
        >
          <Text style={styles.bannerSimulacionTexto}>
            Modo Demo Activo (Toca para desactivar)
          </Text>
        </TouchableOpacity>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onVolver}
          style={styles.btnVolver}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.azulOscuro} />
        </TouchableOpacity>

        <StatusBadge status={status} deviceName={deviceName} blinkValue={blinkValue} />

        <TouchableOpacity
          testID="simulacion-toggle"
          onPress={() => setModoSimulacion(!modoSimulacion)}
          style={styles.btnSimulacion}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name={modoSimulacion ? 'bug-report' : 'developer-mode'}
            size={22}
            color={modoSimulacion ? Colors.errorRojo : Colors.textoSecundario}
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Panel de Control</Text>
          <Text style={styles.subtitle}>Selecciona el acceso que deseas abrir</Text>
        </View>

        {/* Card Peatonal */}
        <View style={styles.controlCard}>
          <View style={styles.cardHeader}>
            <View style={styles.iconContainer}>
              <MaterialIcons name="door-front" size={28} color={Colors.azulPrimario} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Puerta Peatonal</Text>
              <Text style={styles.cardDesc}>Puerta de entrada peatonal del edificio</Text>
            </View>
          </View>

          <View style={styles.buttonWrapper}>
            {ejecutando === 'peatonal' && (
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    transform: [{ scale: pulsePeatonal }],
                    opacity: pulsePeatonal.interpolate({
                      inputRange: [1, 1.2],
                      outputRange: [0.4, 0],
                    }),
                  },
                ]}
              />
            )}
            <TouchableOpacity
              testID="btn-peatonal"
              style={[
                styles.btnCircular,
                ejecutando === 'peatonal' && styles.btnCircularActive,
                status !== 'connected' && styles.btnCircularOffline,
              ]}
              onPress={() => handleAbrir('peatonal', 'E')}
              disabled={ejecutando !== null}
              activeOpacity={0.8}
            >
              {ejecutando === 'peatonal' ? (
                <ActivityIndicator color="#FFFFFF" size="large" />
              ) : (
                <MaterialIcons name="door-front" size={40} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.btnHint}>Pulsar para abrir</Text>
        </View>

        {/* Card Garaje */}
        <View style={styles.controlCard}>
          <View style={styles.cardHeader}>
            <View style={styles.iconContainer}>
              <MaterialIcons name="garage" size={28} color={Colors.azulPrimario} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Portón de Garaje</Text>
              <Text style={styles.cardDesc}>Portón automático para entrada de vehículos</Text>
            </View>
          </View>

          <View style={styles.buttonWrapper}>
            {ejecutando === 'garaje' && (
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    transform: [{ scale: pulseGaraje }],
                    opacity: pulseGaraje.interpolate({
                      inputRange: [1, 1.2],
                      outputRange: [0.4, 0],
                    }),
                  },
                ]}
              />
            )}
            <TouchableOpacity
              testID="btn-garaje"
              style={[
                styles.btnCircular,
                ejecutando === 'garaje' && styles.btnCircularActive,
                status !== 'connected' && styles.btnCircularOffline,
              ]}
              onPress={() => handleAbrir('garaje', 'H')}
              disabled={ejecutando !== null}
              activeOpacity={0.8}
            >
              {ejecutando === 'garaje' ? (
                <ActivityIndicator color="#FFFFFF" size="large" />
              ) : (
                <MaterialIcons name="garage" size={40} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.btnHint}>Pulsar para abrir</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Subcomponente de estado
interface StatusBadgeProps {
  status: string;
  deviceName: string | null;
  blinkValue: Animated.Value;
}

const StatusBadge = React.memo(({ status, deviceName, blinkValue }: StatusBadgeProps) => {
  let badgeBg = '#EAEAEA';
  let badgeText = 'Desconectado';
  let iconColor = '#888888';
  let labelColor = '#666666';
  let showLoading = false;

  switch (status) {
    case 'connected':
      badgeBg = '#E2F3E1';
      badgeText = deviceName ? `${deviceName}` : 'Conectado';
      iconColor = Colors.exitoVerde;
      labelColor = Colors.exitoVerde;
      break;
    case 'connecting':
      badgeBg = '#FFF4E5';
      badgeText = 'Conectando...';
      iconColor = '#FF9800';
      labelColor = '#B26A00';
      showLoading = true;
      break;
    case 'disabled':
      badgeBg = '#FCE8E6';
      badgeText = 'Bluetooth apagado';
      iconColor = Colors.errorRojo;
      labelColor = Colors.errorRojo;
      break;
    case 'unauthorized':
      badgeBg = '#FCE8E6';
      badgeText = 'Sin permisos';
      iconColor = Colors.errorRojo;
      labelColor = Colors.errorRojo;
      break;
    case 'unpaired':
      badgeBg = '#FCE8E6';
      badgeText = 'Sin vincular';
      iconColor = Colors.errorRojo;
      labelColor = Colors.errorRojo;
      break;
  }

  return (
    <Animated.View style={{ opacity: blinkValue }}>
      <View style={[styles.badge, { backgroundColor: badgeBg }]}>
        {showLoading ? (
          <ActivityIndicator size="small" color={iconColor} style={styles.badgeIcon} />
        ) : (
          <MaterialIcons
            name={status === 'connected' ? 'bluetooth-connected' : 'bluetooth'}
            size={14}
            color={iconColor}
            style={styles.badgeIcon}
          />
        )}
        <Text style={[styles.badgeLabel, { color: labelColor }]}>{badgeText}</Text>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.beigeBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  btnVolver: {
    padding: 8,
  },
  btnSimulacion: {
    padding: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  badgeIcon: {
    marginRight: 4,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  bannerSimulacion: {
    backgroundColor: '#FFE0B2',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  bannerSimulacionTexto: {
    color: '#E65100',
    fontSize: 12,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 20,
    alignItems: 'stretch',
    gap: 20,
  },
  titleContainer: {
    marginBottom: 8,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.azulOscuro,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textoSecundario,
    marginTop: 4,
  },
  controlCard: {
    backgroundColor: Colors.beigeCard,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.01)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: 16,
  },
  iconContainer: {
    backgroundColor: '#EAE7DF',
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.azulOscuro,
  },
  cardDesc: {
    fontSize: 12,
    color: Colors.textoSecundario,
    marginTop: 2,
  },
  buttonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
    height: 120,
    position: 'relative',
    marginVertical: 8,
  },
  btnCircular: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.azulPrimario,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.azulPrimario,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  btnCircularActive: {
    backgroundColor: Colors.azulOscuro,
    shadowColor: Colors.azulOscuro,
  },
  btnCircularOffline: {
    backgroundColor: '#9A9A9A',
    shadowColor: '#9A9A9A',
  },
  pulseRing: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.azulPrimario,
  },
  btnHint: {
    fontSize: 11,
    color: Colors.textoSecundario,
    fontWeight: '600',
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
