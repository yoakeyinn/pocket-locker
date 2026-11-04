import { t } from '../styles/i18n';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Animated,
  AppState,
  PanResponder,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { MaterialIcons } from '@expo/vector-icons';
import BluetoothService, { useBluetooth } from '../services/BluetoothService';
import {
  PuertasHeader,
  DoorActionButton,
  AccessSegmentedControl,
} from '../components/puertas/PuertasComponents';
import { LogService } from '../services/StorageService';
import { mostrarModal } from '../components/Modal';
import { SinDispositivoCard } from '../components/SinDispositivoCard';
import { Text } from '../styles/tipografia/Tipografia';
import tw, { Colors, cicloPulso, tipografia } from '../styles/styles';
import { Puerta, USUARIO_POR_DEFECTO, parsearPin } from '../services/comun';

const PUERTAS: Puerta[] = ['peatonal', 'garaje'];

function usePuertasAnimations(status: string, ejecutando: Puerta | null) {
  const cardEntranceAnim = useRef(new Animated.Value(1)).current;
  const buttonPressScale = useRef(new Animated.Value(1)).current;
  const blinkValue = useRef(new Animated.Value(1)).current;

  const radarPulse1 = useRef(new Animated.Value(1)).current;
  const radarPulse2 = useRef(new Animated.Value(1)).current;
  const radarOpacity1 = useRef(new Animated.Value(0.35)).current;
  const radarOpacity2 = useRef(new Animated.Value(0.2)).current;

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

  useEffect(() => {
    if (!ejecutando) {
      radarPulse1.setValue(1);
      radarPulse2.setValue(1);
      radarOpacity1.setValue(0.35);
      radarOpacity2.setValue(0.2);
      return;
    }

    const radarAnim = Animated.loop(
      Animated.parallel([
        cicloPulso(radarPulse1, radarOpacity1, { escala: 1.38, opacidadInicial: 0.5, duracion: 1000 }),
        cicloPulso(radarPulse2, radarOpacity2, { escala: 1.5, opacidadInicial: 0.4, duracion: 1000, retraso: 400 }),
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

export default function PuertasScreen() {
  const {
    status,
    deviceName,
    deviceMac,
    userName,
    devicePin,
    conectar,
    desconectar,
    enviarComando,
    tiempoRestanteBloqueo,
    iniciarBloqueoMargen,
    ultimaPuerta,
    guardarUltimaPuerta,
    pedirActivar,
  } = useBluetooth();

  // Puertas que autoriza el código guardado; si no se reconoce, se dejan ambas y decide el ESP32.
  const acceso = parsearPin(devicePin);
  const permitidas = acceso.esValido ? PUERTAS.filter((puerta) => acceso[puerta]) : PUERTAS;
  const tieneAmbas = permitidas.length === PUERTAS.length;

  const [pestanaElegida, setPestanaElegida] = useState<Puerta>(ultimaPuerta || 'peatonal');
  const pestanaActiva = permitidas.includes(pestanaElegida) ? pestanaElegida : permitidas[0];
  const [ejecutando, setEjecutando] = useState<Puerta | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [scrollHabilitado, setScrollHabilitado] = useState(true);

  const ejecutandoRef = useRef(false);
  const isTransitioningRef = useRef(false);
  const autoDisconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mensajeExitoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aperturaAnimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const terminarEjecucion = useCallback(() => {
    ejecutandoRef.current = false;
    setEjecutando(null);
  }, []);

  const desconectarEnSilencio = useCallback(() => {
    desconectar().catch(() => {});
  }, [desconectar]);

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
  } = usePuertasAnimations(status, ejecutando);

  const panX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setPestanaElegida(ultimaPuerta);
  }, [ultimaPuerta]);

  const centrarTarjeta = useCallback(() => {
    Animated.spring(panX, { toValue: 0, friction: 6, tension: 60, useNativeDriver: true }).start();
  }, [panX]);

  const transicionarHacia = useCallback(
    (direccion: 'izquierda' | 'derecha', objetivo?: Puerta) => {
      if (!tieneAmbas || isTransitioningRef.current) return;

      const siguiente: Puerta =
        objetivo || (pestanaActiva === 'peatonal' ? 'garaje' : 'peatonal');

      if (siguiente === pestanaActiva) {
        centrarTarjeta();
        return;
      }

      isTransitioningRef.current = true;
      Haptics.selectionAsync().catch(() => {});
      guardarUltimaPuerta(siguiente).catch(() => {});

      const exitX = direccion === 'izquierda' ? -130 : 130;
      const enterX = -exitX;

      Animated.parallel([
        Animated.timing(panX, { toValue: exitX, duration: 130, useNativeDriver: true }),
        Animated.timing(cardEntranceAnim, { toValue: 0.15, duration: 130, useNativeDriver: true }),
      ]).start(() => {
        setPestanaElegida(siguiente);
        panX.setValue(enterX);
        Animated.parallel([
          Animated.spring(panX, { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }),
          Animated.timing(cardEntranceAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
        ]).start(() => {
          isTransitioningRef.current = false;
        });
      });
    },
    [pestanaActiva, tieneAmbas, panX, cardEntranceAnim, guardarUltimaPuerta, centrarTarjeta]
  );

  const panResponder = useMemo(() => {
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
          centrarTarjeta();
        }
      },
      onPanResponderTerminate: () => {
        setScrollHabilitado(true);
        centrarTarjeta();
      },
    });
  }, [tieneAmbas, transicionarHacia, panX, centrarTarjeta]);

  const handleAbrir = useCallback(
    async (tipo: Puerta, comando: string) => {
      if (ejecutandoRef.current || ejecutando !== null || tiempoRestanteBloqueo > 0) return;

      LogService.info(`[Puertas] Abrir ${tipo} (comando ${comando}, estado=${status})`);
      ejecutandoRef.current = true;
      setEjecutando(tipo);
      Haptics.selectionAsync().catch(() => {});

      try {
        if (status === 'disabled') {
          LogService.info('Bluetooth apagado. Solicitando activación...');
          const activado = await pedirActivar().catch(() => false);
          if (!activado) {
            terminarEjecucion();
            return;
          }
        }

        if (status === 'unauthorized') {
          terminarEjecucion();
          mostrarModal(
            'Sin permisos',
            `${t('pl_app_titulo')} necesita permisos de Bluetooth y ${t('pl_dispositivos_cercanos')} para conectarse.`,
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
            LogService.error(`[Puertas] No se pudo conectar para abrir ${tipo}`, btErr);
            terminarEjecucion();
            const rawMsg = btErr?.message || '';
            const esErrorPermiso =
              rawMsg.toLowerCase().includes('permiso') ||
              rawMsg.toLowerCase().includes('permission') ||
              rawMsg.toLowerCase().includes('securityexception') ||
              rawMsg.toLowerCase().includes('lacks permission');

            if (esErrorPermiso) {
              mostrarModal(
                'Permisos de Bluetooth necesarios',
                `${t('pl_app_titulo')} necesita permisos de Bluetooth en este teléfono para conectarse a la puerta.\n\nPor favor, actívalos en Ajustes de la aplicación.`,
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Abrir Ajustes', onPress: () => BluetoothService.abrirAjustesApp() },
                ]
              );
            } else {
              mostrarModal(
                'Error de conexión',
                `No se pudo conectar con el ${t('pl_app_titulo')}.\n\n${rawMsg || 'Verifica que esté encendido y en rango.'}`
              );
            }
            return;
          }
        }

        try {
          await enviarComando(comando);
          iniciarBloqueoMargen(5);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          LogService.info(`[Puertas] ${tipo} abierta correctamente`);
          setMensajeExito(
            tipo === 'garaje' ? '¡Portón de garaje abriéndose!' : '¡Puerta peatonal abriéndose!'
          );

          if (mensajeExitoTimerRef.current) clearTimeout(mensajeExitoTimerRef.current);
          mensajeExitoTimerRef.current = setTimeout(() => setMensajeExito(null), 4500);

          if (aperturaAnimTimerRef.current) clearTimeout(aperturaAnimTimerRef.current);
          aperturaAnimTimerRef.current = setTimeout(() => {
            terminarEjecucion();
            aperturaAnimTimerRef.current = null;
          }, 2500);

          if (autoDisconnectTimerRef.current) clearTimeout(autoDisconnectTimerRef.current);
          autoDisconnectTimerRef.current = setTimeout(() => {
            desconectarEnSilencio();
          }, 1500);
        } catch (err: any) {
          LogService.error(`[Puertas] No se pudo enviar el comando de ${tipo}`, err);
          terminarEjecucion();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          mostrarModal('No se pudo abrir', err?.message || 'No se pudo enviar el comando.');
          desconectarEnSilencio();
        }
      } catch (e: any) {
        LogService.error(`[Puertas] Error inesperado al abrir ${tipo}`, e);
        terminarEjecucion();
        mostrarModal('Error', e?.message || 'Ocurrió un error inesperado');
      }
    },
    [ejecutando, tiempoRestanteBloqueo, status, conectar, enviarComando, iniciarBloqueoMargen, pedirActivar, desconectarEnSilencio, terminarEjecucion]
  );

  useEffect(() => {
    return () => {
      limpiarTimers();
      desconectarEnSilencio();
    };
  }, [limpiarTimers, desconectarEnSilencio]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') desconectarEnSilencio();
    });
    return () => sub.remove();
  }, [desconectarEnSilencio]);

  useEffect(() => {
    if (status !== 'connected' || ejecutando !== null || tiempoRestanteBloqueo > 0) return;
    const timer = setTimeout(desconectarEnSilencio, 25000);
    return () => clearTimeout(timer);
  }, [status, ejecutando, tiempoRestanteBloqueo, desconectarEnSilencio]);

  const botonDeshabilitado = ejecutando !== null || tiempoRestanteBloqueo > 0;

  if (!deviceMac) {
    return (
      <SafeAreaView style={tw`flex-1 bg-beige`} edges={['top', 'bottom']}>
        <PuertasHeader
          userName={userName || USUARIO_POR_DEFECTO}
          status={status}
          deviceName={deviceName}
          blinkValue={blinkValue}
          onPressAjustes={() => router.push('/ajustes')}
        />
        <View style={tw`flex-1 justify-center px-5`}>
          <SinDispositivoCard onBuscar={() => router.replace('/buscar')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={tw`flex-1 bg-beige`} edges={['top', 'bottom']}>
      <PuertasHeader
        userName={userName || USUARIO_POR_DEFECTO}
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
          <Text style={tw`font-display text-xl font-bold text-black tracking-tight mb-4`}>
            Panel de Control
          </Text>

          <AccessSegmentedControl
            pestanaActiva={pestanaActiva}
            tieneAmbas={tieneAmbas}
            onSelect={(puerta) =>
              transicionarHacia(puerta === 'garaje' ? 'izquierda' : 'derecha', puerta)
            }
          />

          {acceso.dias !== null && (
            <Text testID="acceso-temporal" style={[tipografia.anotacion, tw`text-xs mt-1`]}>
              {t(acceso.dias === 1 ? 'pl_acceso_temporal_dia' : 'pl_acceso_temporal_dias', { dias: String(acceso.dias) })}
            </Text>
          )}
        </View>

        <View style={tw`h-12 items-center justify-center my-1 w-full`}>
          {mensajeExito && (
            <View
              testID="banner-exito-apertura"
              style={tw`flex-row items-center justify-center bg-silver border border-gray rounded-2xl px-4 py-2 shadow-sm`}
            >
              <MaterialIcons name="check-circle" size={20} color={Colors.black} />
              <Text style={tw`text-black font-bold text-xs ml-2`}>
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
                  pestanaActiva === 'peatonal' ? tw`w-6 h-1.5 bg-black` : tw`w-1.5 h-1.5 bg-silver`,
                ]}
              />
              <TouchableOpacity
                onPress={() => transicionarHacia('izquierda', 'garaje')}
                activeOpacity={0.7}
                style={[
                  tw`rounded-full`,
                  pestanaActiva === 'garaje' ? tw`w-6 h-1.5 bg-black` : tw`w-1.5 h-1.5 bg-silver`,
                ]}
              />
            </View>
            <Text style={tw`text-xs text-gray mt-2.5 tracking-wider`}>
              Desliza para cambiar
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
