import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import BluetoothService, { DispositivoBT } from '../../services/BluetoothService';
import LogService from '../../services/LogService';
import { parsearYValidarPin, DEFAULT_SECURITY_PIN } from '../../services/StorageService';
import { useBluetooth } from '../../context/BluetoothContext';
import ActiveLockerCard from '../../components/inicio/ActiveLockerCard';
import DeviceListItem from '../../components/inicio/DeviceListItem';
import EmptyDeviceList from '../../components/inicio/EmptyDeviceList';
import ModalVincularDispositivo from '../../components/inicio/ModalVincularDispositivo';
import tw from '../../styles/tailwind';

/**
 * Pantalla Principal (Tab Inicio).
 * Arquitectura modular con 3 vistas adaptativas:
 * 1. Vista Locker Activo: Si ya existe un dispositivo guardado, muestra la tarjeta de control.
 * 2. Vista Auto-Conexión (Radar): Búsqueda inteligente en segundo plano tras el onboarding sin fricción.
 * 3. Vista Manual (Dispositivos cercanos): Fallback automático tras 12s para selección y recarga manual.
 */
export default function InicioScreen() {
  const {
    deviceMac,
    deviceName,
    userName,
    status,
    actualizarDispositivoVinculado,
    conectar,
  } = useBluetooth();

  // Estados de modo de conexión y escaneo
  const [modoConexion, setModoConexion] = useState<'auto' | 'manual'>('auto');
  const [estadoAutoTexto, setEstadoAutoTexto] = useState('Buscando tu Pocket Locker...');
  const [estadoAutoSubtexto, setEstadoAutoSubtexto] = useState('Detección inteligente en segundo plano');

  const [escaneando, setEscaneando] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [dispositivos, setDispositivos] = useState<DispositivoBT[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [dispositivoSeleccionado, setDispositivoSeleccionado] = useState<DispositivoBT | null>(null);
  const [nombrePersonalizado, setNombrePersonalizado] = useState('');
  const [pinSeguridad, setPinSeguridad] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Cerrojos y referencias para evitar carreras y dobles permisos
  const autoDetectadoRef = useRef(false);
  const autoIniciadoRef = useRef(false);
  const busquedaEnProgresoRef = useRef(false);
  const autoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const userNameRef = useRef(userName);
  userNameRef.current = userName;
  const actualizarRef = useRef(actualizarDispositivoVinculado);
  actualizarRef.current = actualizarDispositivoVinculado;

  // Referencias para la animación del radar (ondas expansivas concéntricas a 60 FPS)
  const radarPulse1 = useRef(new Animated.Value(1)).current;
  const radarPulse2 = useRef(new Animated.Value(1)).current;
  const radarOpacity1 = useRef(new Animated.Value(0.7)).current;
  const radarOpacity2 = useRef(new Animated.Value(0.7)).current;

  // Ciclo continuo de la animación del radar durante la búsqueda automática
  useEffect(() => {
    let anim1: Animated.CompositeAnimation | null = null;
    let anim2: Animated.CompositeAnimation | null = null;

    if (!deviceMac && modoConexion === 'auto') {
      const crearRadarLoop = (pulse: Animated.Value, opacity: Animated.Value, delayMs: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delayMs),
            Animated.parallel([
              Animated.timing(pulse, {
                toValue: 2.2,
                duration: 2200,
                useNativeDriver: true,
              }),
              Animated.timing(opacity, {
                toValue: 0,
                duration: 2200,
                useNativeDriver: true,
              }),
            ]),
            Animated.timing(pulse, {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0.7,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        );
      };

      anim1 = crearRadarLoop(radarPulse1, radarOpacity1, 0);
      anim2 = crearRadarLoop(radarPulse2, radarOpacity2, 1100);

      anim1.start();
      anim2.start();
    }

    return () => {
      if (anim1) anim1.stop();
      if (anim2) anim2.stop();
      radarPulse1.setValue(1);
      radarPulse2.setValue(1);
      radarOpacity1.setValue(0.7);
      radarOpacity2.setValue(0.7);
    };
  }, [deviceMac, modoConexion, radarPulse1, radarPulse2, radarOpacity1, radarOpacity2]);

  /**
   * Abre directamente los Ajustes de Bluetooth del teléfono.
   */
  const onAbrirAjustesBluetooth = useCallback(async () => {
    try {
      await BluetoothService.abrirAjustesBluetooth();
    } catch {
      Alert.alert(
        'Ajustes',
        'Abre la aplicación de Ajustes de tu móvil y entra en Bluetooth para vincular el Pocket Locker.'
      );
    }
  }, []);

  /**
   * Inicia el diálogo de vinculación manual al pulsar un dispositivo de la lista.
   */
  const iniciarVinculacion = useCallback((dispositivo: DispositivoBT) => {
    BluetoothService.cancelarDescubrimiento().catch(() => {});
    setEscaneando(false);
    setDispositivoSeleccionado(dispositivo);
    setNombrePersonalizado(dispositivo.name && dispositivo.name !== 'Sin nombre' ? dispositivo.name : 'Pocket Locker');
    setPinSeguridad('');
    setModalVisible(true);
  }, []);

  /**
   * Búsqueda manual de dispositivos (pull-to-refresh o botón de recargar).
   */
  const buscarDispositivos = useCallback(async (desdePullToRefresh: boolean = false) => {
    if (busquedaEnProgresoRef.current) return;
    busquedaEnProgresoRef.current = true;

    if (desdePullToRefresh) {
      setRefrescando(true);
    } else {
      setEscaneando(true);
    }
    setDispositivos([]);

    try {
      const soportado = await BluetoothService.esSoportado();
      if (!soportado) {
        Alert.alert('Bluetooth no disponible', 'Tu dispositivo móvil no soporta Bluetooth');
        return;
      }

      const okPermisos = await BluetoothService.solicitarPermisos();
      if (!okPermisos) {
        Alert.alert(
          'Permisos necesarios',
          'Pocket Locker necesita permisos de Bluetooth y Ubicación para encontrar tu dispositivo.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Abrir Ajustes', onPress: onAbrirAjustesBluetooth },
          ]
        );
        return;
      }

      const encendido = await BluetoothService.estaEncendido();
      if (!encendido) {
        const activado = await BluetoothService.pedirActivar();
        if (!activado) {
          Alert.alert(
            'Bluetooth apagado',
            'Por favor, activa el Bluetooth para poder buscar y conectar tu Pocket Locker.',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Abrir Ajustes', onPress: onAbrirAjustesBluetooth },
            ]
          );
          return;
        }
      }

      const lista = await BluetoothService.listarDispositivos((nuevoDispositivo) => {
        setDispositivos((prev) => {
          const index = prev.findIndex((d) => d.address.toLowerCase() === nuevoDispositivo.address.toLowerCase());
          if (index >= 0) {
            const copia = [...prev];
            copia[index] = nuevoDispositivo;
            return copia;
          }
          return [...prev, nuevoDispositivo];
        });
      });
      setDispositivos(lista);
    } catch (e: any) {
      Alert.alert('Aviso', e?.message || 'No se pudieron buscar dispositivos');
    } finally {
      setEscaneando(false);
      setRefrescando(false);
      busquedaEnProgresoRef.current = false;
    }
  }, [onAbrirAjustesBluetooth]);

  const buscarDispositivosRef = useRef(buscarDispositivos);
  buscarDispositivosRef.current = buscarDispositivos;

  /**
   * Búsqueda y vinculación automática inteligente en segundo plano.
   * Si detecta PLBT, lo empareja y conecta directamente. Si pasan 12s, pasa a modo manual.
   */
  const ejecutarAutoConexion = useCallback(async () => {
    if (busquedaEnProgresoRef.current || deviceMac) return;
    busquedaEnProgresoRef.current = true;
    autoDetectadoRef.current = false;
    setModoConexion('auto');
    setEstadoAutoTexto('Buscando tu Pocket Locker...');
    setEstadoAutoSubtexto('Búsqueda inteligente en segundo plano');

    // Timeout de 12 segundos: si no se detecta el locker, cambiar suavemente al modo manual
    if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current);
    autoTimeoutRef.current = setTimeout(() => {
      if (!autoDetectadoRef.current) {
        busquedaEnProgresoRef.current = false;
        setModoConexion('manual');
        buscarDispositivosRef.current(false);
      }
    }, 15000);

    try {
      const soportado = await BluetoothService.esSoportado();
      if (!soportado) {
        setModoConexion('manual');
        return;
      }

      const okPermisos = await BluetoothService.solicitarPermisos();
      if (!okPermisos) {
        setModoConexion('manual');
        return;
      }

      const encendido = await BluetoothService.estaEncendido();
      if (!encendido) {
        setEstadoAutoTexto('Activando Bluetooth...');
        setEstadoAutoSubtexto('Esperando confirmación del sistema');
        const activado = await BluetoothService.pedirActivar();
        if (!activado) {
          setModoConexion('manual');
          return;
        }
      }

      setEstadoAutoTexto('Buscando tu Pocket Locker...');
      setEstadoAutoSubtexto('Localizando dispositivo cercano');

      const lista = await BluetoothService.listarDispositivos(async (nuevoDispositivo) => {
        if (autoDetectadoRef.current) return;
        const nombreUpper = (nuevoDispositivo.name || '').toUpperCase().trim();
        if (
          nombreUpper === 'PLBT' ||
          nombreUpper.startsWith('PLBT') ||
          nombreUpper.includes('POCKET LOCKER') ||
          nombreUpper.includes('ESP32')
        ) {
          autoDetectadoRef.current = true;
          if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current);

          setEstadoAutoTexto('Pocket Locker detectado');
          setEstadoAutoSubtexto('Vinculando y configurando acceso...');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

          try {
            await BluetoothService.cancelarDescubrimiento();
            await BluetoothService.vincularDispositivo(nuevoDispositivo.address);
            await actualizarRef.current(
              nuevoDispositivo.address,
              'Pocket Locker',
              nuevoDispositivo.type || 'classic',
              DEFAULT_SECURITY_PIN,
              userNameRef.current || 'Usuario'
            );
            router.replace('/control');
          } catch {
            setModoConexion('manual');
          }
        }
      }, 10000);

      // Si terminó el descubrimiento sin auto-detección por callback, verificar si el locker está en la lista final devuelta
      if (!autoDetectadoRef.current) {
        const lockerEnLista = lista.find((d) => {
          const n = (d.name || '').toUpperCase().trim();
          return (
            n === 'PLBT' ||
            n.startsWith('PLBT') ||
            n.includes('POCKET LOCKER') ||
            n.includes('ESP32')
          );
        });

        if (lockerEnLista) {
          autoDetectadoRef.current = true;
          if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current);

          setEstadoAutoTexto('Pocket Locker detectado');
          setEstadoAutoSubtexto('Vinculando y configurando acceso...');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

          try {
            await BluetoothService.cancelarDescubrimiento();
            await BluetoothService.vincularDispositivo(lockerEnLista.address);
            await actualizarRef.current(
              lockerEnLista.address,
              'Pocket Locker',
              lockerEnLista.type || 'classic',
              DEFAULT_SECURITY_PIN,
              userNameRef.current || 'Usuario'
            );
            router.replace('/control');
            return;
          } catch (err) {
            LogService.warn('Aviso en auto-conexión por lista:', err);
            setDispositivos(lista);
            setModoConexion('manual');
            return;
          }
        }

        setDispositivos(lista);
        setModoConexion('manual');
      }
    } catch {
      if (!autoDetectadoRef.current) {
        setModoConexion('manual');
      }
    } finally {
      busquedaEnProgresoRef.current = false;
    }
  }, [deviceMac]);

  /**
   * Confirma y guarda la vinculación manual con PIN.
   */
  const confirmarVinculacion = useCallback(async () => {
    if (!dispositivoSeleccionado) return;
    const nombre = nombrePersonalizado.trim() || dispositivoSeleccionado.name || 'Pocket Locker';
    const pinLimpio = pinSeguridad.trim().toUpperCase();

    if (!pinLimpio) {
      Alert.alert('PIN requerido', 'Introduce el PIN de seguridad configurado para tu Pocket Locker.');
      return;
    }

    const val = parsearYValidarPin(pinLimpio);
    if (!val.esValido) {
      Alert.alert('PIN inválido', val.mensajeError || 'El PIN introducido no cumple con el formato requerido.');
      return;
    }

    setGuardando(true);
    try {
      await BluetoothService.cancelarDescubrimiento();
      await BluetoothService.vincularDispositivo(dispositivoSeleccionado.address);

      // Cerrar modal de inmediato para eliminar fricción y navegar a control
      setModalVisible(false);

      await actualizarDispositivoVinculado(
        dispositivoSeleccionado.address,
        nombre,
        dispositivoSeleccionado.type || 'classic',
        pinLimpio,
        userName || 'Usuario'
      );
      router.replace('/control');
    } catch (e: any) {
      setModalVisible(true);
      Alert.alert(
        'Error de vinculación',
        e?.message || 'No se pudo vincular con el Pocket Locker.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir Ajustes', onPress: onAbrirAjustesBluetooth },
        ]
      );
    } finally {
      setGuardando(false);
    }
  }, [dispositivoSeleccionado, nombrePersonalizado, pinSeguridad, actualizarDispositivoVinculado, userName, onAbrirAjustesBluetooth]);

  /**
   * Entra a los controles si ya está vinculado.
   */
  const entrarAlDispositivo = useCallback(async () => {
    if (status !== 'connected') {
      try {
        await conectar();
      } catch {
        // Permitir entrar incluso si requiere reconectar en el panel
      }
    }
    router.push('/control');
  }, [status, conectar]);

  const renderDeviceItem = useCallback(
    ({ item }: { item: DispositivoBT }) => (
      <DeviceListItem item={item} onPress={() => iniciarVinculacion(item)} />
    ),
    [iniciarVinculacion]
  );

  // Inicializar escaneo automático al entrar si no hay dispositivo vinculado
  useEffect(() => {
    if (!deviceMac && !autoIniciadoRef.current && modoConexion === 'auto') {
      autoIniciadoRef.current = true;
      ejecutarAutoConexion();
    }
  }, [deviceMac, modoConexion, ejecutarAutoConexion]);

  // Limpieza de tareas solo al desmontar la pantalla
  useEffect(() => {
    return () => {
      if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current);
      BluetoothService.cancelarDescubrimiento().catch(() => {});
    };
  }, []);

  // Listener de AppState con control anti-reentrada (solo en modo manual)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && !deviceMac) {
        if (modoConexion === 'manual' && !busquedaEnProgresoRef.current) {
          buscarDispositivos(false);
        }
      }
    });
    return () => sub?.remove?.();
  }, [deviceMac, modoConexion, buscarDispositivos]);

  // VISTA 1: Dispositivo guardado
  if (deviceMac) {
    return (
      <SafeAreaView style={tw`flex-1 bg-beige-bg`} edges={['top']}>
        <View style={tw`flex-1 p-5`}>
          <Text style={tw`text-2xl font-bold text-azul-oscuro mb-1`}>Mi Pocket Locker</Text>
          <Text style={tw`text-sm text-texto-secundario mb-6`}>
            Pulsa en el locker para acceder a los controles.
          </Text>

          <ActiveLockerCard
            deviceName={deviceName}
            deviceMac={deviceMac}
            status={status}
            onPress={entrarAlDispositivo}
          />
        </View>
      </SafeAreaView>
    );
  }

  // VISTA 2: Búsqueda y Auto-Conexión Inteligente (Radar Animation)
  if (modoConexion === 'auto') {
    return (
      <SafeAreaView style={tw`flex-1 bg-beige-bg`} edges={['top', 'bottom']}>
        <View style={tw`flex-1 items-center justify-between p-6`}>
          {/* Cabecera */}
          <View style={tw`items-center mt-6`}>
            <Text style={tw`text-2xl font-bold text-azul-oscuro text-center`}>
              Buscando tu Pocket Locker
            </Text>
            <Text style={tw`text-sm text-texto-secundario text-center mt-1.5 px-4 leading-5`}>
              Configurando el acceso automáticamente para {userName || 'tu perfil'}
            </Text>
          </View>

          {/* Área animada central con radar nativo */}
          <View style={tw`items-center justify-center my-auto w-72 h-72`}>
            {/* Anillo de radar exterior */}
            <Animated.View
              style={[
                tw`w-64 h-64 rounded-full absolute bg-azul-primario/15 border border-azul-primario/25`,
                {
                  transform: [{ scale: radarPulse1 }],
                  opacity: radarOpacity1,
                },
              ]}
            />
            {/* Anillo de radar intermedio */}
            <Animated.View
              style={[
                tw`w-52 h-52 rounded-full absolute bg-azul-primario/20 border border-azul-primario/30`,
                {
                  transform: [{ scale: radarPulse2 }],
                  opacity: radarOpacity2,
                },
              ]}
            />

            {/* Círculo central con icono */}
            <View style={tw`w-28 h-28 rounded-full bg-azul-primario items-center justify-center shadow-xl border-4 border-white`}>
              <MaterialIcons name="lock-outline" size={48} color="#FFFFFF" />
            </View>
          </View>

          {/* Estado dinámico inferior y opción manual */}
          <View style={tw`w-full items-center mb-8`}>
            <View style={tw`flex-row items-center justify-center mb-2`}>
              <ActivityIndicator size="small" color="#2C5F8A" />
              <Text style={tw`text-base font-bold text-azul-oscuro ml-2.5`}>
                {estadoAutoTexto}
              </Text>
            </View>
            <Text style={tw`text-xs text-texto-secundario text-center mb-6`}>
              {estadoAutoSubtexto}
            </Text>

            <TouchableOpacity
              testID="btn-ir-manual"
              style={tw`py-3 px-6 rounded-2xl bg-white border border-stone-200 shadow-sm`}
              onPress={() => {
                if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current);
                setModoConexion('manual');
                buscarDispositivos(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={tw`text-xs font-bold text-azul-oscuro tracking-wider uppercase`}>
                Ver dispositivos manualmente
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // VISTA 3: Escaneo manual de dispositivos cercanos (Fallback)
  return (
    <SafeAreaView style={tw`flex-1 bg-beige-bg`} edges={['top']}>
      <View style={tw`flex-1 p-5`}>
        <Text style={tw`text-2xl font-bold text-azul-oscuro mb-1`}>Dispositivos cercanos</Text>
        <Text style={tw`text-sm text-texto-secundario mb-5`}>
          Dispositivos Bluetooth accesibles a tu alrededor. Pulsa en tu Pocket Locker para vincularlo.
        </Text>

        {/* Botonera superior con Recargar y Reintentar Auto */}
        <View style={tw`flex-row items-center mb-4`}>
          <TouchableOpacity
            testID="btn-buscar-dispositivos"
            style={tw`flex-1 mr-2 flex-row items-center justify-center py-3.5 px-4 rounded-2xl bg-azul-primario shadow-sm ${
              escaneando || refrescando ? 'opacity-60' : ''
            }`}
            onPress={() => buscarDispositivos(false)}
            disabled={escaneando || refrescando}
            activeOpacity={0.85}
          >
            {escaneando ? (
              <View style={tw`flex-row items-center justify-center`}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={tw`text-white font-bold text-sm ml-2`}>Buscando...</Text>
              </View>
            ) : (
              <View style={tw`flex-row items-center justify-center`}>
                <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
                <Text style={tw`text-white font-bold text-sm ml-2`}>Recargar lista</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            testID="btn-reintentar-auto"
            style={tw`py-3.5 px-4 rounded-2xl bg-white border border-stone-200 shadow-sm items-center justify-center`}
            onPress={() => {
              autoDetectadoRef.current = false;
              busquedaEnProgresoRef.current = false;
              setModoConexion('auto');
              ejecutarAutoConexion();
            }}
            activeOpacity={0.85}
          >
            <MaterialIcons name="radar" size={20} color="#2C5F8A" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={dispositivos}
          keyExtractor={(item) => item.address}
          renderItem={renderDeviceItem}
          style={tw`flex-1`}
          contentContainerStyle={dispositivos.length === 0 ? tw`flex-grow justify-center` : tw`pb-6`}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => buscarDispositivos(true)}
              colors={['#2C5F8A']}
              tintColor="#2C5F8A"
            />
          }
          ListEmptyComponent={
            !escaneando && !refrescando ? (
              <EmptyDeviceList onAbrirAjustes={onAbrirAjustesBluetooth} />
            ) : null
          }
          ListFooterComponent={
            dispositivos.length > 0 ? (
              <TouchableOpacity
                testID="btn-abrir-ajustes-footer"
                style={tw`flex-row items-center justify-center py-4 px-2`}
                onPress={onAbrirAjustesBluetooth}
                activeOpacity={0.7}
              >
                <MaterialIcons name="settings-bluetooth" size={18} color="#2C5F8A" />
                <Text style={tw`text-xs font-semibold text-azul-primario ml-2`}>
                  Abrir Ajustes de Bluetooth del teléfono
                </Text>
              </TouchableOpacity>
            ) : null
          }
        />
      </View>

      <ModalVincularDispositivo
        visible={modalVisible}
        guardando={guardando}
        userName={userName}
        nombrePersonalizado={nombrePersonalizado}
        setNombrePersonalizado={setNombrePersonalizado}
        pinSeguridad={pinSeguridad}
        setPinSeguridad={setPinSeguridad}
        onCancel={() => setModalVisible(false)}
        onConfirm={confirmarVinculacion}
      />
    </SafeAreaView>
  );
}
