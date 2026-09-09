import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, AppState, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import BluetoothService, { DispositivoBT, useBluetooth } from '../services/BluetoothService';
import { parsearYValidarPin, DEFAULT_SECURITY_PIN, LogService } from '../services/StorageService';
import {
  ActiveLockerCard,
  DeviceDiscoveryListView,
  ModalVincularDispositivo,
  BluetoothPermissionBlockedView,
  RadarScannerView,
} from '../components/InicioComponents';
import tw from '../styles';

/**
 * Pantalla Principal (Inicio).
 * Flujo adaptativo:
 * 1. Locker Activo: Muestra tarjeta del dispositivo guardado.
 * 2. Radar Auto-Conexión: Detección inteligente en segundo plano.
 * 3. Búsqueda Manual: Fallback de selección de lista tras 15s.
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

  const [modoConexion, setModoConexion] = useState<'auto' | 'manual'>('auto');
  const [estadoAutoTexto, setEstadoAutoTexto] = useState('Buscando tu Pocket Locker...');
  const [estadoAutoSubtexto, setEstadoAutoSubtexto] = useState('Búsqueda inteligente en segundo plano');

  const [escaneando, setEscaneando] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [dispositivos, setDispositivos] = useState<DispositivoBT[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [dispositivoSeleccionado, setDispositivoSeleccionado] = useState<DispositivoBT | null>(null);
  const [nombrePersonalizado, setNombrePersonalizado] = useState('');
  const [pinSeguridad, setPinSeguridad] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [permisosDenegados, setPermisosDenegados] = useState(false);

  const autoDetectadoRef = useRef(false);
  const autoIniciadoRef = useRef(false);
  const busquedaEnProgresoRef = useRef(false);
  const autoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const onAbrirAjustesBluetooth = useCallback(async () => {
    try {
      await BluetoothService.abrirAjustesBluetooth();
    } catch {
      Alert.alert('Ajustes', 'Abre Ajustes en tu teléfono y entra en Bluetooth.');
    }
  }, []);

  const onAbrirAjustesApp = useCallback(async () => {
    try {
      await BluetoothService.abrirAjustesApp();
    } catch {
      Alert.alert('Ajustes', 'Abre Ajustes en tu teléfono y concede permisos a Pocket Locker.');
    }
  }, []);

  const iniciarVinculacion = useCallback((dispositivo: DispositivoBT) => {
    BluetoothService.cancelarDescubrimiento().catch(() => {});
    setEscaneando(false);
    setDispositivoSeleccionado(dispositivo);
    setNombrePersonalizado(dispositivo.name && dispositivo.name !== 'Sin nombre' ? dispositivo.name : 'Pocket Locker');
    setPinSeguridad('');
    setModalVisible(true);
  }, []);

  const buscarDispositivos = useCallback(async (desdePullToRefresh: boolean = false) => {
    if (busquedaEnProgresoRef.current) return;
    busquedaEnProgresoRef.current = true;

    if (desdePullToRefresh) setRefrescando(true);
    else setEscaneando(true);
    setDispositivos([]);

    try {
      if (!(await BluetoothService.esSoportado())) {
        Alert.alert('Bluetooth no disponible', 'Tu dispositivo móvil no soporta Bluetooth');
        return;
      }
      if (!(await BluetoothService.solicitarPermisos())) {
        setPermisosDenegados(true);
        return;
      }
      setPermisosDenegados(false);

      if (!(await BluetoothService.estaEncendido())) {
        const activado = await BluetoothService.pedirActivar();
        if (!activado) {
          Alert.alert(
            'Bluetooth apagado',
            'Por favor, activa el Bluetooth para buscar tu Pocket Locker.',
            [{ text: 'Cancelar', style: 'cancel' }, { text: 'Abrir Ajustes', onPress: onAbrirAjustesBluetooth }]
          );
          return;
        }
      }

      const lista = await BluetoothService.listarDispositivos((nuevo) => {
        setDispositivos((prev) => {
          const idx = prev.findIndex((d) => d.address.toLowerCase() === nuevo.address.toLowerCase());
          if (idx >= 0) {
            const copia = [...prev];
            copia[idx] = nuevo;
            return copia;
          }
          return [...prev, nuevo];
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

  const ejecutarAutoConexion = useCallback(async () => {
    if (busquedaEnProgresoRef.current || deviceMac) return;
    busquedaEnProgresoRef.current = true;
    autoDetectadoRef.current = false;
    setModoConexion('auto');
    setEstadoAutoTexto('Buscando tu Pocket Locker...');
    setEstadoAutoSubtexto('Búsqueda inteligente en segundo plano');

    if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current);
    autoTimeoutRef.current = setTimeout(() => {
      if (!autoDetectadoRef.current) {
        busquedaEnProgresoRef.current = false;
        setModoConexion('manual');
        buscarDispositivos(false);
      }
    }, 15000);

    try {
      if (!(await BluetoothService.esSoportado())) {
        setModoConexion('manual');
        return;
      }
      if (!(await BluetoothService.solicitarPermisos())) {
        setPermisosDenegados(true);
        return;
      }
      setPermisosDenegados(false);

      if (!(await BluetoothService.estaEncendido())) {
        const activado = await BluetoothService.pedirActivar();
        if (!activado) {
          setModoConexion('manual');
          return;
        }
      }

      const esLocker = (dev: DispositivoBT) => {
        const n = (dev.name || '').toUpperCase();
        return n.includes('PLBT') || n.includes('POCKET LOCKER') || n.includes('ESP32');
      };

      const vincularLockerDirecto = async (dev: DispositivoBT) => {
        autoDetectadoRef.current = true;
        if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current);
        setEstadoAutoTexto('¡Pocket Locker detectado!');
        setEstadoAutoSubtexto('Vinculando con PIN 2415...');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        try {
          await BluetoothService.cancelarDescubrimiento();
          await BluetoothService.vincularDispositivo(dev.address);
          await actualizarDispositivoVinculado(
            dev.address,
            'Pocket Locker',
            dev.type || 'classic',
            DEFAULT_SECURITY_PIN,
            userName || 'Usuario'
          );
          router.replace('/control');
        } catch (autoErr) {
          LogService.warn('Aviso en auto-conexión:', autoErr);
          setModoConexion('manual');
        }
      };

      const lista = await BluetoothService.listarDispositivos((dev) => {
        if (!autoDetectadoRef.current && esLocker(dev)) {
          vincularLockerDirecto(dev);
        }
      }, 7000);

      if (!autoDetectadoRef.current) {
        const lockerEnLista = lista.find(esLocker);
        if (lockerEnLista) {
          await vincularLockerDirecto(lockerEnLista);
          return;
        }
        setDispositivos(lista);
        setModoConexion('manual');
      }
    } catch {
      if (!autoDetectadoRef.current) setModoConexion('manual');
    } finally {
      busquedaEnProgresoRef.current = false;
    }
  }, [deviceMac, buscarDispositivos, actualizarDispositivoVinculado, userName]);

  const confirmarVinculacion = useCallback(async () => {
    if (!dispositivoSeleccionado) return;
    const nombre = nombrePersonalizado.trim() || dispositivoSeleccionado.name || 'Pocket Locker';
    const pinLimpio = pinSeguridad.trim().toUpperCase();

    if (!pinLimpio) {
      Alert.alert('PIN requerido', 'Introduce el PIN de seguridad configurado.');
      return;
    }

    const val = parsearYValidarPin(pinLimpio);
    if (!val.esValido) {
      Alert.alert('PIN inválido', val.mensajeError || 'PIN no válido.');
      return;
    }

    setGuardando(true);
    try {
      await BluetoothService.cancelarDescubrimiento();
      await BluetoothService.vincularDispositivo(dispositivoSeleccionado.address);
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
      Alert.alert('Error de vinculación', e?.message || 'No se pudo vincular con el Pocket Locker.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Abrir Ajustes', onPress: onAbrirAjustesBluetooth },
      ]);
    } finally {
      setGuardando(false);
    }
  }, [dispositivoSeleccionado, nombrePersonalizado, pinSeguridad, actualizarDispositivoVinculado, userName, onAbrirAjustesBluetooth]);

  const entrarAlDispositivo = useCallback(async () => {
    Haptics.selectionAsync().catch(() => {});
    router.replace('/control');
    if (status !== 'connected') {
      conectar().catch(() => {});
    }
  }, [status, conectar]);

  const handleCambiarAManual = useCallback(() => {
    autoDetectadoRef.current = true;
    if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current);
    busquedaEnProgresoRef.current = false;
    setModoConexion('manual');
    buscarDispositivos(false);
  }, [buscarDispositivos]);

  useEffect(() => {
    if (!deviceMac && !autoIniciadoRef.current) {
      autoIniciadoRef.current = true;
      ejecutarAutoConexion();
    }
    return () => {
      if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current);
    };
  }, [deviceMac, ejecutarAutoConexion]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !deviceMac && modoConexion === 'auto') {
        autoIniciadoRef.current = false;
        ejecutarAutoConexion();
      }
    });
    return () => sub.remove();
  }, [deviceMac, modoConexion, ejecutarAutoConexion]);

  if (permisosDenegados) {
    return (
      <BluetoothPermissionBlockedView
        onConcederPermisos={async () => {
          const ok = await BluetoothService.solicitarPermisos();
          setPermisosDenegados(!ok);
          if (ok) ejecutarAutoConexion();
        }}
        onAbrirAjustes={onAbrirAjustesApp}
      />
    );
  }

  if (deviceMac) {
    return (
      <SafeAreaView style={tw`flex-1 bg-beige-bg`} edges={['top']}>
        <View style={tw`flex-1 p-5`}>
          <View style={tw`flex-row items-center justify-between mb-6`}>
            <View>
              <Text style={tw`text-2xl font-bold text-azul-oscuro`}>Hola, {userName || 'Usuario'}</Text>
              <Text style={tw`text-sm text-texto-secundario mt-0.5`}>Dispositivo vinculado y listo</Text>
            </View>
            <TouchableOpacity
              testID="btn-ir-ajustes"
              onPress={() => router.push('/ajustes')}
              style={tw`w-10 h-10 items-center justify-center rounded-xl bg-white shadow-sm border border-stone-200`}
              activeOpacity={0.7}
            >
              <MaterialIcons name="settings" size={22} color="#1A3A5C" />
            </TouchableOpacity>
          </View>
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

  if (modoConexion === 'auto') {
    return (
      <RadarScannerView
        userName={userName}
        estadoTexto={estadoAutoTexto}
        estadoSubtexto={estadoAutoSubtexto}
        onCambiarAManual={handleCambiarAManual}
      />
    );
  }

  return (
    <>
      <DeviceDiscoveryListView
        dispositivos={dispositivos}
        escaneando={escaneando}
        refrescando={refrescando}
        onBuscar={buscarDispositivos}
        onReintentarAuto={() => {
          autoDetectadoRef.current = false;
          busquedaEnProgresoRef.current = false;
          setModoConexion('auto');
          ejecutarAutoConexion();
        }}
        onSeleccionarDispositivo={iniciarVinculacion}
        onAbrirAjustesBluetooth={onAbrirAjustesBluetooth}
      />
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
    </>
  );
}
