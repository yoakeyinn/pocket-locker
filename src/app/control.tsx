import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Alert,
  Animated,
  AppState,
  PanResponder,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { MaterialIcons } from '@expo/vector-icons';
import BluetoothService, { useBluetooth } from '../services/BluetoothService';
import {
  ControlHeader,
  DoorActionButton,
  AccessSegmentedControl,
} from '../components/ControlComponents';
import StorageService, { LogService } from '../services/StorageService';
import tw from '../styles';

/**
 * Hook modular de animaciones fluidas a 60 FPS.
 * Coordina transiciones de tarjetas, pulsación elástica, parpadeo y radar concéntrico.
 */
function useControlAnimations(
  status: string,
  ejecutando: 'peatonal' | 'garaje' | null,
  tiempoRestanteBloqueo: number
) {
  const cardEntranceAnim = useRef(new Animated.Value(1)).current;
  const buttonPressScale = useRef(new Animated.Value(1)).current;
  const blinkValue = useRef(new Animated.Value(1)).current;

  const radarPulse1 = useRef(new Animated.Value(1)).current;
  const radarPulse2 = useRef(new Animated.Value(1)).current;
  const radarOpacity1 = useRef(new Animated.Value(0.35)).current;
  const radarOpacity2 = useRef(new Animated.Value(0.2)).current;

  // Parpadeo suave cuando el estado es 'connecting'
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (status === 'connecting') {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(blinkValue, { toValue: 0.35, duration: 650, useNativeDriver: true }),
          Animated.timing(blinkValue, { toValue: 1, duration: 650, useNativeDriver: true }),
        ])
      );
      anim.start();
    } else {
      blinkValue.setValue(1);
    }
    return () => anim?.stop();
  }, [status, blinkValue]);

  // Pulsos de radar concéntricos durante la apertura
  useEffect(() => {
    if (!ejecutando) {
      radarPulse1.setValue(1);
      radarPulse2.setValue(1);
      radarOpacity1.setValue(0.35);
      radarOpacity2.setValue(0.2);
      return;
    }

    const pulseCycle = (pulse: Animated.Value, opacity: Animated.Value, maxScale: number, maxOpacity: number, delayMs = 0) =>
      Animated.sequence([
        Animated.delay(delayMs),
        Animated.parallel([
          Animated.timing(pulse, { toValue: maxScale, duration: 1000, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ]),
        Animated.timing(pulse, { toValue: 1, duration: 0, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: maxOpacity, duration: 0, useNativeDriver: true }),
      ]);

    const radarAnim = Animated.loop(
      Animated.parallel([
        pulseCycle(radarPulse1, radarOpacity1, 1.38, 0.5, 0),
        pulseCycle(radarPulse2, radarOpacity2, 1.5, 0.4, 400),
      ])
    );
    radarAnim.start();

    return () => radarAnim.stop();
  }, [ejecutando, radarPulse1, radarPulse2, radarOpacity1, radarOpacity2]);

  const onPressInButton = useCallback(() => {
    Animated.spring(buttonPressScale, { toValue: 0.94, friction: 5, tension: 100, useNativeDriver: true }).start();
  }, [buttonPressScale]);

  const onPressOutButton = useCallback(() => {
    Animated.spring(buttonPressScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }).start();
  }, [buttonPressScale]);

  return {
    cardEntranceAnim,
    buttonPressScale,
    blinkValue,
    radarPulse1,
    radarPulse2,
    radarOpacity1,
    radarOpacity2,
    onPressInButton,
    onPressOutButton,
  };
}

/**
 * Pantalla principal de control de accesos (Panel de Control).
 *
 * Características:
 * - Deslizable con scroll infinito bidireccional entre Peatonal y Garaje.
 * - Margen de exclusión mutua de 5 segundos.
 * - Desconexión inmediata al salir o minimizar para liberar el ESP32.
 */
export default function ControlScreen() {
  const {
    status,
    deviceName,
    conectar,
    desconectar,
    enviarComando,
    tiempoRestanteBloqueo,
    iniciarBloqueoMargen,
    ultimaPuerta,
    guardarUltimaPuerta,
    pedirActivar,
    userRole,
    permisos,
    diasRestantes,
  } = useBluetooth();

  const tienePeatonal = userRole === 'admin' || (permisos ? permisos.peatonal !== false : true);
  const tieneGaraje = userRole === 'admin' || (permisos ? permisos.garaje !== false : true);
  const tieneAmbas = tienePeatonal && tieneGaraje;

  const [pestanaActiva, setPestanaActiva] = useState<'peatonal' | 'garaje'>(
    !tienePeatonal && tieneGaraje ? 'garaje' : ultimaPuerta || 'peatonal'
  );
  const [ejecutando, setEjecutando] = useState<'peatonal' | 'garaje' | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [scrollHabilitado, setScrollHabilitado] = useState(true);

  const ejecutandoRef = useRef(false);
  const isTransitioningRef = useRef(false);
  const autoDisconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mensajeExitoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const aperturaAnimTimerRef = useRef<NodeJS.Timeout | null>(null);

  const limpiarTimers = useCallback(() => {
    if (autoDisconnectTimerRef.current) clearTimeout(autoDisconnectTimerRef.current);
    if (mensajeExitoTimerRef.current) clearTimeout(mensajeExitoTimerRef.current);
    if (aperturaAnimTimerRef.current) clearTimeout(aperturaAnimTimerRef.current);
  }, []);

  const {
    cardEntranceAnim,
    buttonPressScale,
    blinkValue,
    radarPulse1,
    radarPulse2,
    radarOpacity1,
    radarOpacity2,
    onPressInButton,
    onPressOutButton,
  } = useControlAnimations(status, ejecutando, tiempoRestanteBloqueo);

  const panX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!tienePeatonal && tieneGaraje) {
      setPestanaActiva('garaje');
    } else if (tienePeatonal && !tieneGaraje) {
      setPestanaActiva('peatonal');
    } else if (ultimaPuerta) {
      setPestanaActiva(ultimaPuerta);
    } else {
      StorageService.getUltimaPuerta()
        .then((puerta) => { if (puerta) setPestanaActiva(puerta); })
        .catch(() => {});
    }
  }, [ultimaPuerta, tienePeatonal, tieneGaraje]);

  const transicionarHacia = useCallback(
    (direccion: 'izquierda' | 'derecha', objetivo?: 'peatonal' | 'garaje') => {
      if (!tieneAmbas || isTransitioningRef.current) return;

      const siguiente: 'peatonal' | 'garaje' =
        objetivo || (pestanaActiva === 'peatonal' ? 'garaje' : 'peatonal');

      if (siguiente === pestanaActiva) {
        Animated.spring(panX, { toValue: 0, friction: 6, tension: 60, useNativeDriver: true }).start();
        return;
      }

      isTransitioningRef.current = true;
      Haptics.selectionAsync().catch(() => {});
      guardarUltimaPuerta?.(siguiente)?.catch?.(() => {});
      StorageService.saveUltimaPuerta(siguiente).catch(() => {});

      const exitX = direccion === 'izquierda' ? -130 : 130;
      const enterX = -exitX;

      Animated.parallel([
        Animated.timing(panX, { toValue: exitX, duration: 130, useNativeDriver: true }),
        Animated.timing(cardEntranceAnim, { toValue: 0.15, duration: 130, useNativeDriver: true }),
      ]).start(() => {
        setPestanaActiva(siguiente);
        panX.setValue(enterX);
        Animated.parallel([
          Animated.spring(panX, { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }),
          Animated.timing(cardEntranceAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
        ]).start(() => {
          isTransitioningRef.current = false;
        });
      });
    },
    [pestanaActiva, panX, cardEntranceAnim, guardarUltimaPuerta, tieneAmbas]
  );

  const panResponder = useMemo(() => {
    if (typeof PanResponder === 'undefined' || !PanResponder.create) {
      return { panHandlers: {} };
    }

    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        tieneAmbas && !ejecutandoRef.current && Math.abs(g.dx) >= 20 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderGrant: () => {
        panX.stopAnimation();
        isTransitioningRef.current = false;
        setScrollHabilitado(false);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        if (Math.abs(g.dx) > 15) {
          const deltaX = g.dx > 0 ? g.dx - 15 : g.dx + 15;
          panX.setValue(deltaX * 0.8);
        }
      },
      onPanResponderRelease: (_, g) => {
        setScrollHabilitado(true);
        const { dx, vx } = g;
        const esFlick = Math.abs(vx) > 0.25 && Math.abs(dx) > 20;
        const esArrastre = Math.abs(dx) > 40;

        if (dx < 0 && (esFlick || esArrastre)) {
          transicionarHacia('izquierda');
        } else if (dx > 0 && (esFlick || esArrastre)) {
          transicionarHacia('derecha');
        } else {
          Animated.spring(panX, { toValue: 0, friction: 6, tension: 60, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => {
        setScrollHabilitado(true);
        Animated.spring(panX, { toValue: 0, friction: 6, tension: 60, useNativeDriver: true }).start();
      },
    });
  }, [transicionarHacia, panX]);

  const handleAbrir = useCallback(
    async (tipo: 'peatonal' | 'garaje', comando: string) => {
      if (ejecutandoRef.current || ejecutando !== null || tiempoRestanteBloqueo > 0) return;

      if (tipo === 'peatonal' && !tienePeatonal) {
        Alert.alert('Sin permiso', 'No tienes permiso para abrir la puerta peatonal.');
        return;
      }
      if (tipo === 'garaje' && !tieneGaraje) {
        Alert.alert('Sin permiso', 'No tienes permiso para abrir el portón de garaje.');
        return;
      }

      ejecutandoRef.current = true;
      setEjecutando(tipo);
      Haptics.selectionAsync().catch(() => {});

      try {
        if (status === 'unpaired') {
          Alert.alert('Sin dispositivo', 'No hay un dispositivo vinculado. Vincula uno primero.', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Vincular', onPress: () => router.replace('/inicio') },
          ]);
          return;
        }

        if (status === 'disabled') {
          LogService.info('Bluetooth apagado. Solicitando activación...');
          const activado = await pedirActivar?.().catch(() => false);
          if (!activado) {
            ejecutandoRef.current = false;
            setEjecutando(null);
            return;
          }
        }

        if (status === 'unauthorized') {
          ejecutandoRef.current = false;
          setEjecutando(null);
          Alert.alert(
            'Sin permisos',
            'Pocket Locker necesita permisos de Bluetooth y Dispositivos cercanos para conectarse.',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Abrir Ajustes', onPress: () => BluetoothService.abrirAjustesApp() },
            ]
          );
          return;
        }

        if (status !== 'connected') {
          try {
            await conectar();
          } catch (btErr: any) {
            ejecutandoRef.current = false;
            setEjecutando(null);
            const rawMsg = btErr?.message || '';
            const esErrorPermiso =
              rawMsg.toLowerCase().includes('permiso') ||
              rawMsg.toLowerCase().includes('permission') ||
              rawMsg.toLowerCase().includes('securityexception') ||
              rawMsg.toLowerCase().includes('lacks permission');

            if (esErrorPermiso) {
              Alert.alert(
                'Permisos de Bluetooth necesarios',
                'Pocket Locker necesita permisos de Bluetooth en este teléfono para conectarse a la puerta.\n\nPor favor, actívalos en Ajustes de la aplicación.',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Abrir Ajustes', onPress: () => BluetoothService.abrirAjustesApp() },
                ]
              );
            } else {
              Alert.alert(
                'Error de conexión',
                `No se pudo conectar con el Pocket Locker.\n\n${rawMsg || 'Verifica que esté encendido y en rango.'}`
              );
            }
            return;
          }
        }

        try {
          await enviarComando(comando);
          iniciarBloqueoMargen(5);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setMensajeExito(
            tipo === 'garaje' ? '¡Portón de garaje abriéndose!' : '¡Puerta peatonal abriéndose!'
          );

          if (mensajeExitoTimerRef.current) clearTimeout(mensajeExitoTimerRef.current);
          mensajeExitoTimerRef.current = setTimeout(() => setMensajeExito(null), 4500);

          if (aperturaAnimTimerRef.current) clearTimeout(aperturaAnimTimerRef.current);
          aperturaAnimTimerRef.current = setTimeout(() => {
            ejecutandoRef.current = false;
            setEjecutando(null);
            aperturaAnimTimerRef.current = null;
          }, 2500);

          if (autoDisconnectTimerRef.current) clearTimeout(autoDisconnectTimerRef.current);
          autoDisconnectTimerRef.current = setTimeout(() => {
            desconectar?.()?.catch?.(() => {});
          }, 1500);
        } catch (err: any) {
          ejecutandoRef.current = false;
          setEjecutando(null);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          Alert.alert('No se pudo abrir', err?.message || 'No se pudo enviar el comando.');
          desconectar?.()?.catch?.(() => {});
        }
      } catch (e: any) {
        ejecutandoRef.current = false;
        setEjecutando(null);
        Alert.alert('Error', e?.message || 'Ocurrió un error inesperado');
      }
    },
    [
      ejecutando,
      tiempoRestanteBloqueo,
      status,
      conectar,
      enviarComando,
      iniciarBloqueoMargen,
      desconectar,
      tienePeatonal,
      tieneGaraje,
    ]
  );

  const onVolver = useCallback(() => {
    limpiarTimers();
    desconectar?.()?.catch?.(() => {});
    router.replace('/inicio');
  }, [limpiarTimers, desconectar]);

  useEffect(() => {
    return () => {
      limpiarTimers();
      desconectar?.()?.catch?.(() => {});
    };
  }, [limpiarTimers, desconectar]);

  useEffect(() => {
    const sub = AppState?.addEventListener?.('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        desconectar?.()?.catch?.(() => {});
      }
    });
    return () => sub?.remove?.();
  }, [desconectar]);

  useEffect(() => {
    if (status !== 'connected' || ejecutando !== null || tiempoRestanteBloqueo > 0) return;
    const timer = setTimeout(() => { desconectar?.()?.catch?.(() => {}); }, 25000);
    return () => clearTimeout(timer);
  }, [status, ejecutando, tiempoRestanteBloqueo, desconectar]);

  const botonDeshabilitado = ejecutando !== null || tiempoRestanteBloqueo > 0;

  return (
    <SafeAreaView style={tw`flex-1 bg-beige-bg`} edges={['top', 'bottom']}>
      <ControlHeader
        onVolver={onVolver}
        status={status}
        deviceName={deviceName}
        blinkValue={blinkValue}
        onPressAjustes={() => router.push('/ajustes')}
      />

      <ScrollView
        scrollEnabled={scrollHabilitado}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={tw`p-5 pb-10 flex-grow justify-between`}
      >
        <View style={tw`items-center`}>
          <Text style={tw`text-xl font-bold text-azul-oscuro tracking-tight mb-4`}>
            Panel de Control
          </Text>

          <AccessSegmentedControl
            pestanaActiva={pestanaActiva}
            tieneAmbas={tieneAmbas}
            onSelect={(puerta) =>
              transicionarHacia(puerta === 'garaje' ? 'izquierda' : 'derecha', puerta)
            }
          />

          {diasRestantes !== null && (
            <View style={tw`mt-2 px-3 py-1 bg-amber-50 rounded-full border border-amber-200/80`}>
              <Text style={tw`text-[11px] font-bold text-amber-800`}>
                Acceso temporal: {diasRestantes} {diasRestantes === 1 ? 'día' : 'días'}
              </Text>
            </View>
          )}
        </View>

        <View style={tw`h-12 items-center justify-center my-1 w-full`}>
          {mensajeExito && (
            <View
              testID="banner-exito-apertura"
              style={tw`flex-row items-center justify-center bg-emerald-50 border border-emerald-300 rounded-2xl px-4 py-2 shadow-sm`}
            >
              <MaterialIcons name="check-circle" size={20} color="#10B981" />
              <Text style={tw`text-emerald-900 font-bold text-xs ml-2`}>
                {mensajeExito}
              </Text>
            </View>
          )}
        </View>

        <View style={tw`w-full my-auto`} {...panResponder.panHandlers}>
          <Animated.View
            style={[
              tw`w-full items-center justify-center`,
              {
                opacity: cardEntranceAnim,
                transform: [
                  { translateX: panX },
                  {
                    scale: cardEntranceAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.95, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <DoorActionButton
              tipo={pestanaActiva}
              ejecutando={ejecutando}
              tiempoRestanteBloqueo={tiempoRestanteBloqueo}
              botonDeshabilitado={botonDeshabilitado}
              onPress={() => handleAbrir(pestanaActiva, pestanaActiva === 'garaje' ? 'G' : 'P')}
              onPressIn={onPressInButton}
              onPressOut={onPressOutButton}
              buttonPressScale={buttonPressScale}
              radarPulse1={radarPulse1}
              radarPulse2={radarPulse2}
              radarOpacity1={radarOpacity1}
              radarOpacity2={radarOpacity2}
            />
          </Animated.View>
        </View>

        {tieneAmbas && (
          <View style={tw`items-center pb-2`}>
            <View style={tw`flex-row items-center justify-center gap-2`}>
              <TouchableOpacity
                onPress={() => transicionarHacia('derecha', 'peatonal')}
                activeOpacity={0.7}
                style={[
                  tw`rounded-full`,
                  pestanaActiva === 'peatonal' ? tw`w-6 h-1.5 bg-emerald-600` : tw`w-1.5 h-1.5 bg-stone-300`,
                ]}
              />
              <TouchableOpacity
                onPress={() => transicionarHacia('izquierda', 'garaje')}
                activeOpacity={0.7}
                style={[
                  tw`rounded-full`,
                  pestanaActiva === 'garaje' ? tw`w-6 h-1.5 bg-azul-primario` : tw`w-1.5 h-1.5 bg-stone-300`,
                ]}
              />
            </View>
            <Text style={tw`text-xs text-stone-400 mt-2.5 tracking-wider`}>
              Desliza para cambiar
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
