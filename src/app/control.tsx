import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  PanResponder,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { MaterialIcons } from '@expo/vector-icons';
import { useBluetooth } from '../context/BluetoothContext';
import ControlHeader from '../components/control/ControlHeader';
import DoorTabSelector from '../components/control/DoorTabSelector';
import DoorActionButton from '../components/control/DoorActionButton';
import AccessInfoBanner from '../components/control/AccessInfoBanner';
import tw from '../styles/tailwind';

/**
 * Pantalla principal de control de accesos (Panel de Control).
 * Proporciona la interfaz táctil modular para activar los relés del portón y de la puerta peatonal.
 *
 * Características:
 * - Arquitectura modular dividida en componentes reutilizables con estilos exclusivos Tailwind CSS.
 * - Animaciones nativas a 60 FPS (useNativeDriver: true).
 * - Reconexión automática bajo demanda y persistencia de última puerta utilizada.
 * - Feedback háptico nativo en cada interacción.
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
    userRole,
    permisos,
    diasRestantes,
    estaBloqueado,
  } = useBluetooth();

  const tienePeatonal = userRole === 'admin' || (permisos ? permisos.peatonal !== false : true);
  const tieneGaraje = userRole === 'admin' || (permisos ? permisos.garaje !== false : true);
  const tieneAmbas = tienePeatonal && tieneGaraje;

  // Estado de la acción en curso ('peatonal' | 'garaje' | null)
  const [ejecutando, setEjecutando] = useState<'peatonal' | 'garaje' | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [pestanaActiva, setPestanaActiva] = useState<'peatonal' | 'garaje'>(
    !tienePeatonal && tieneGaraje ? 'garaje' : ultimaPuerta || 'peatonal'
  );
  const ejecutandoRef = useRef(false);
  const pestanaInicializadaRef = useRef(false);
  const autoDisconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mensajeExitoTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sincronizar con la última puerta guardada o la permitida si el contexto resuelve tras el montaje inicial
  useEffect(() => {
    if (!pestanaInicializadaRef.current) {
      if (!tienePeatonal && tieneGaraje) {
        pestanaInicializadaRef.current = true;
        setPestanaActiva('garaje');
      } else if (tienePeatonal && !tieneGaraje) {
        pestanaInicializadaRef.current = true;
        setPestanaActiva('peatonal');
      } else if (ultimaPuerta) {
        pestanaInicializadaRef.current = true;
        setPestanaActiva(ultimaPuerta);
      }
    }
  }, [ultimaPuerta, tienePeatonal, tieneGaraje]);

  // Referencias para animaciones nativas de interfaz
  const pulsePeatonal = useRef(new Animated.Value(1)).current;
  const pulseOuterPeatonal = useRef(new Animated.Value(1)).current;
  const pulseGaraje = useRef(new Animated.Value(1)).current;
  const pulseOuterGaraje = useRef(new Animated.Value(1)).current;
  const blinkValue = useRef(new Animated.Value(1)).current;
  const cardEntranceAnim = useRef(new Animated.Value(0)).current;
  const buttonPressScale = useRef(new Animated.Value(1)).current;
  const cooldownAnim = useRef(new Animated.Value(1)).current;

  // Estado de bloqueo de scroll vertical para evitar conflictos durante el swipe
  const [scrollHabilitado, setScrollHabilitado] = useState(true);

  // Valor animado para la traslación horizontal táctil de la tarjeta (swipe)
  const panX = useRef(new Animated.Value(0)).current;
  const isTransitioningRef = useRef(false);

  // Ancho de referencia de la ventana para calcular el desplazamiento fuera de pantalla
  const screenWidth = (Dimensions?.get ? Dimensions.get('window')?.width : 375) || 375;

  // Animación de entrada de la tarjeta al montar la pantalla
  useEffect(() => {
    Animated.spring(cardEntranceAnim, {
      toValue: 1,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [cardEntranceAnim]);

  /**
   * Transición por deslizamiento continuo a 60 FPS sin parpadeos ni pérdidas de opacidad.
   * La tarjeta activa se traslada fuera de pantalla y la nueva entra elásticamente desde el lado contrario,
   * permitiendo un ciclo continuo e infinito (scroll infinito bidireccional).
   */
  const transicionarHacia = useCallback(
    (direccion: 'izquierda' | 'derecha', objetivo?: 'peatonal' | 'garaje') => {
      if (isTransitioningRef.current) return;

      const siguiente: 'peatonal' | 'garaje' =
        objetivo || (pestanaActiva === 'peatonal' ? 'garaje' : 'peatonal');

      if (siguiente === pestanaActiva) {
        Animated.spring(panX, {
          toValue: 0,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        }).start();
        return;
      }

      isTransitioningRef.current = true;
      Haptics.selectionAsync().catch(() => {});
      guardarUltimaPuerta?.(siguiente)?.catch?.(() => {});

      const slideDist = screenWidth + 30;
      const exitX = direccion === 'izquierda' ? -slideDist : slideDist;
      const enterX = -exitX;

      Animated.timing(panX, {
        toValue: exitX,
        duration: 110,
        useNativeDriver: true,
      }).start(() => {
        setPestanaActiva(siguiente);
        panX.setValue(enterX);
        // Desbloqueo inmediato para que swiping consecutivo responda sin retardos
        isTransitioningRef.current = false;
        Animated.spring(panX, {
          toValue: 0,
          friction: 7,
          tension: 55,
          useNativeDriver: true,
        }).start();
      });
    },
    [pestanaActiva, panX, screenWidth, guardarUltimaPuerta]
  );

  /**
   * Cambia de pestaña al pulsar el selector superior DoorTabSelector.
   */
  const cambiarPestana = useCallback(
    (nuevaPestana: 'peatonal' | 'garaje') => {
      if (nuevaPestana === pestanaActiva) return;
      const direccion = nuevaPestana === 'garaje' ? 'izquierda' : 'derecha';
      transicionarHacia(direccion, nuevaPestana);
    },
    [pestanaActiva, transicionarHacia]
  );

  /**
   * Gestor de gestos táctiles altamente sensible para deslizamiento intuitivo con scroll infinito.
   * - Umbral reducido a 6px con tolerancia para arcos naturales del pulgar (dx > dy * 0.5).
   * - Bloqueo de terminación por ScrollView (onPanResponderTerminationRequest: false).
   * - Detención inmediata de animaciones previas para respuesta en swiping continuo.
   */
  const panResponder = useMemo(() => {
    if (typeof PanResponder === 'undefined' || !PanResponder.create) {
      return { panHandlers: {} };
    }

    const puedeCapturar = (gestureState: any) => {
      if (!tieneAmbas || ejecutandoRef.current) return false;
      const dx = Math.abs(gestureState.dx);
      const dy = Math.abs(gestureState.dy);
      // Intención clara de deslizamiento horizontal con tolerancia a inclinación de pulgar
      return dx >= 6 && dx > dy * 0.5;
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => puedeCapturar(gestureState),
      onMoveShouldSetPanResponderCapture: (_, gestureState) => puedeCapturar(gestureState),
      onPanResponderGrant: () => {
        panX.stopAnimation();
        isTransitioningRef.current = false;
        setScrollHabilitado(false);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gestureState) => {
        panX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        setScrollHabilitado(true);
        const dx = gestureState.dx;
        const vx = gestureState.vx;
        const esFlick = Math.abs(vx) > 0.18;
        const esArrastre = Math.abs(dx) > 25;

        if (dx < 0 && (esFlick || esArrastre)) {
          transicionarHacia('izquierda');
        } else if (dx > 0 && (esFlick || esArrastre)) {
          transicionarHacia('derecha');
        } else {
          Animated.spring(panX, {
            toValue: 0,
            friction: 6,
            tension: 60,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        setScrollHabilitado(true);
        Animated.spring(panX, {
          toValue: 0,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        }).start();
      },
    });
  }, [tieneAmbas, transicionarHacia, panX]);

  // Efecto elástico al presionar y soltar el botón circular
  const onPressInButton = useCallback(() => {
    Animated.spring(buttonPressScale, {
      toValue: 0.92,
      speed: 50,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }, [buttonPressScale]);

  const onPressOutButton = useCallback(() => {
    Animated.spring(buttonPressScale, {
      toValue: 1.0,
      speed: 30,
      bounciness: 12,
      useNativeDriver: true,
    }).start();
  }, [buttonPressScale]);

  // Animación de respiración / pulso durante el enfriamiento (cooldown de 5 segundos)
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (tiempoRestanteBloqueo > 0) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(cooldownAnim, {
            toValue: 0.92,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(cooldownAnim, {
            toValue: 1.0,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    } else {
      cooldownAnim.setValue(1.0);
    }
    return () => {
      if (animation) animation.stop();
    };
  }, [tiempoRestanteBloqueo, cooldownAnim]);

  // Animación de parpadeo del badge cuando la conexión está en curso
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
      if (animation) animation.stop();
    };
  }, [status, blinkValue]);

  // Ondas expansivas dobles (sonar) para la puerta peatonal durante su activación
  useEffect(() => {
    let animInner: Animated.CompositeAnimation | null = null;
    let animOuter: Animated.CompositeAnimation | null = null;
    if (status === 'connected' && ejecutando === 'peatonal') {
      animInner = Animated.loop(
        Animated.sequence([
          Animated.timing(pulsePeatonal, {
            toValue: 1.25,
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
      animOuter = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseOuterPeatonal, {
            toValue: 1.5,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOuterPeatonal, {
            toValue: 1.0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      animInner.start();
      animOuter.start();
    } else {
      pulsePeatonal.setValue(1.0);
      pulseOuterPeatonal.setValue(1.0);
    }
    return () => {
      if (animInner) animInner.stop();
      if (animOuter) animOuter.stop();
    };
  }, [status, ejecutando, pulsePeatonal, pulseOuterPeatonal]);

  // Ondas expansivas dobles (sonar) para el garaje durante su activación
  useEffect(() => {
    let animInner: Animated.CompositeAnimation | null = null;
    let animOuter: Animated.CompositeAnimation | null = null;
    if (status === 'connected' && ejecutando === 'garaje') {
      animInner = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseGaraje, {
            toValue: 1.25,
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
      animOuter = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseOuterGaraje, {
            toValue: 1.5,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOuterGaraje, {
            toValue: 1.0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      animInner.start();
      animOuter.start();
    } else {
      pulseGaraje.setValue(1.0);
      pulseOuterGaraje.setValue(1.0);
    }
    return () => {
      if (animInner) animInner.stop();
      if (animOuter) animOuter.stop();
    };
  }, [status, ejecutando, pulseGaraje, pulseOuterGaraje]);

  /**
   * Manejador de evento al presionar cualquiera de los pulsadores de apertura.
   */
  const handleAbrir = useCallback(
    async (tipo: 'peatonal' | 'garaje', comando: string) => {
      if (ejecutandoRef.current || ejecutando !== null || tiempoRestanteBloqueo > 0) {
        return;
      }
      ejecutandoRef.current = true;
      setEjecutando(tipo);
      Haptics.selectionAsync().catch(() => {});

      try {
        if (status === 'unpaired') {
          Alert.alert(
            'Sin dispositivo',
            'No hay un dispositivo vinculado. Vincula uno primero.',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Vincular', onPress: () => router.replace('/(tabs)') },
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
            'Concede permisos de Bluetooth a la aplicación en los ajustes del sistema.'
          );
          return;
        }

        if (status !== 'connected') {
          try {
            await conectar();
          } catch {
            Alert.alert(
              'Error de conexión',
              'No se pudo conectar con el Pocket Locker. Verifica que esté encendido y dentro del rango de cobertura.'
            );
            return;
          }
        }

        if (estaBloqueado) {
          Alert.alert(
            'Acceso bloqueado',
            'Tu acceso está bloqueado o tus días de validez han expirado. Contacta con el administrador del Pocket Locker.'
          );
          return;
        }

        try {
          await enviarComando(comando);
          guardarUltimaPuerta?.(tipo)?.catch?.(() => {});
          iniciarBloqueoMargen(5);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setMensajeExito(
            tipo === 'garaje' ? '¡Portón de garaje abriéndose!' : '¡Puerta peatonal abriéndose!'
          );

          // Limpiar mensaje tras el período de cooldown
          if (mensajeExitoTimerRef.current) clearTimeout(mensajeExitoTimerRef.current);
          mensajeExitoTimerRef.current = setTimeout(() => {
            setMensajeExito(null);
          }, 4500);

          // Desconexión automática óptima:
          // Tras confirmar la orden en el ESP32, liberamos el enlace Bluetooth (1.5s)
          // para que cualquier otro usuario pueda conectarse de inmediato.
          if (autoDisconnectTimerRef.current) clearTimeout(autoDisconnectTimerRef.current);
          autoDisconnectTimerRef.current = setTimeout(() => {
            desconectar?.()?.catch?.(() => {});
          }, 1500);
        } catch (err: any) {
          const mensajeError = err?.message || 'No se pudo enviar el comando.';
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          Alert.alert('No se pudo abrir', mensajeError);
          desconectar?.()?.catch?.(() => {});
        }
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'Ocurrió un error inesperado');
      } finally {
        ejecutandoRef.current = false;
        setEjecutando(null);
      }
    },
    [ejecutando, tiempoRestanteBloqueo, estaBloqueado, status, conectar, enviarComando, iniciarBloqueoMargen, guardarUltimaPuerta, desconectar]
  );

  const onVolver = useCallback(() => {
    if (autoDisconnectTimerRef.current) clearTimeout(autoDisconnectTimerRef.current);
    if (mensajeExitoTimerRef.current) clearTimeout(mensajeExitoTimerRef.current);
    desconectar?.()?.catch?.(() => {});
    router.replace('/(tabs)');
  }, [desconectar]);

  // Desconectar al desmontar la pantalla de control para liberar el locker a otros usuarios
  useEffect(() => {
    return () => {
      if (autoDisconnectTimerRef.current) clearTimeout(autoDisconnectTimerRef.current);
      if (mensajeExitoTimerRef.current) clearTimeout(mensajeExitoTimerRef.current);
      desconectar?.()?.catch?.(() => {});
    };
  }, [desconectar]);

  // Temporizador de inactividad: si el usuario permanece en la pantalla 25s conectado sin accionar,
  // desconectar preventivamente para no acaparar el canal Bluetooth del ESP32.
  useEffect(() => {
    if (status !== 'connected' || ejecutando !== null || tiempoRestanteBloqueo > 0) return;

    const timerInactividad = setTimeout(() => {
      desconectar?.()?.catch?.(() => {});
    }, 25000);

    return () => {
      clearTimeout(timerInactividad);
    };
  }, [status, ejecutando, tiempoRestanteBloqueo, desconectar]);

  const botonDeshabilitado = estaBloqueado || ejecutando !== null || tiempoRestanteBloqueo > 0;

  return (
    <SafeAreaView style={tw`flex-1 bg-beige-bg`} edges={['top']}>
      {/* Header modular */}
      <ControlHeader
        onVolver={onVolver}
        status={status}
        deviceName={deviceName}
        blinkValue={blinkValue}
      />

      <ScrollView scrollEnabled={scrollHabilitado} contentContainerStyle={tw`p-5 pb-10 flex-grow`}>
        {/* Título de la pantalla */}
        <View style={tw`items-center mb-6`}>
          <Text style={tw`text-2xl font-bold text-azul-oscuro text-center`}>Panel de Control</Text>
          <Text style={tw`text-sm text-texto-secundario text-center mt-1`}>
            Selecciona el acceso que deseas abrir
          </Text>
        </View>

        {/* Banners informativos de caducidad/días */}
        <AccessInfoBanner estaBloqueado={estaBloqueado} diasRestantes={diasRestantes} />

        {/* Selector de pestañas */}
        <DoorTabSelector
          pestanaActiva={pestanaActiva}
          onSelect={cambiarPestana}
          tieneAmbas={tieneAmbas}
        />

        {/* Notificación de confirmación de apertura en pantalla */}
        {mensajeExito && (
          <View
            testID="banner-exito-apertura"
            style={tw`flex-row items-center justify-center bg-emerald-50 border border-emerald-300 rounded-2xl px-4 py-3 my-2 shadow-sm`}
          >
            <MaterialIcons name="check-circle" size={22} color="#10B981" />
            <Text style={tw`text-emerald-900 font-bold text-sm ml-2.5`}>
              {mensajeExito}
            </Text>
          </View>
        )}

        {/* Superficie táctil interactiva con PanResponder para swipe horizontal infinito */}
        <View style={tw`w-full overflow-hidden py-1`} {...panResponder.panHandlers}>
          <Animated.View
            style={[
              tw`w-full`,
              {
                opacity: cardEntranceAnim,
                transform: [
                  { translateX: panX },
                  {
                    scale: cardEntranceAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.94, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {pestanaActiva === 'peatonal' ? (
              <DoorActionButton
                tipo="peatonal"
                ejecutando={ejecutando}
                tiempoRestanteBloqueo={tiempoRestanteBloqueo}
                botonDeshabilitado={botonDeshabilitado}
                onPress={() => handleAbrir('peatonal', 'P')}
                onPressIn={onPressInButton}
                onPressOut={onPressOutButton}
                buttonPressScale={buttonPressScale}
                cooldownAnim={cooldownAnim}
                pulseInner={pulsePeatonal}
                pulseOuter={pulseOuterPeatonal}
              />
            ) : (
              <DoorActionButton
                tipo="garaje"
                ejecutando={ejecutando}
                tiempoRestanteBloqueo={tiempoRestanteBloqueo}
                botonDeshabilitado={botonDeshabilitado}
                onPress={() => handleAbrir('garaje', 'G')}
                onPressIn={onPressInButton}
                onPressOut={onPressOutButton}
                buttonPressScale={buttonPressScale}
                cooldownAnim={cooldownAnim}
                pulseInner={pulseGaraje}
                pulseOuter={pulseOuterGaraje}
              />
            )}
          </Animated.View>

          {/* Indicador visual de carrusel interactivo y deslizamiento infinito */}
          {tieneAmbas && (
            <View style={tw`flex-row items-center justify-center mt-5 gap-2`}>
              <TouchableOpacity
                onPress={() => transicionarHacia('derecha')}
                style={tw`p-1.5`}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="chevron-left" size={20} color="#2C5F8A" style={tw`opacity-40`} />
              </TouchableOpacity>

              <View style={tw`flex-row items-center gap-1.5 px-2`}>
                <View
                  style={[
                    tw`rounded-full`,
                    pestanaActiva === 'peatonal'
                      ? tw`w-5 h-1.5 bg-azul-primario`
                      : tw`w-1.5 h-1.5 bg-stone-300`,
                  ]}
                />
                <View
                  style={[
                    tw`rounded-full`,
                    pestanaActiva === 'garaje'
                      ? tw`w-5 h-1.5 bg-azul-primario`
                      : tw`w-1.5 h-1.5 bg-stone-300`,
                  ]}
                />
              </View>

              <TouchableOpacity
                onPress={() => transicionarHacia('izquierda')}
                style={tw`p-1.5`}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="chevron-right" size={20} color="#2C5F8A" style={tw`opacity-40`} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
