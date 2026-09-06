import React, { useState, useCallback } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBluetooth } from '../../context/BluetoothContext';
import { parsearYValidarPin } from '../../services/StorageService';
import BiometricService from '../../services/BiometricService';
import UsuarioCard from '../../components/ajustes/UsuarioCard';
import DispositivoCard from '../../components/ajustes/DispositivoCard';
import PreferenciasCard from '../../components/ajustes/PreferenciasCard';
import AppInfoCard from '../../components/ajustes/AppInfoCard';
import ModalRenombrar from '../../components/ajustes/ModalRenombrar';
import ModalEditarPin from '../../components/ajustes/ModalEditarPin';
import tw from '../../styles/tailwind';

/**
 * Pantalla de Ajustes y Configuración (Tab Ajustes).
 * Permite gestionar:
 * 1. Nombre de usuario y rol (Administrador vs Estándar).
 * 2. Datos del dispositivo vinculado (nombre, MAC, PIN).
 * 3. Preferencias de última puerta y sincronización con el ESP32.
 * 4. Acceso directo a diagnósticos y registros del sistema.
 */
export default function AjustesScreen() {
  const {
    deviceName,
    deviceMac,
    devicePin,
    userName,
    userRole,
    desvincularDispositivo,
    renombrarDispositivo,
    actualizarPinDispositivo,
    guardarNombreUsuario,
    sincronizarConLocker,
  } = useBluetooth();

  const [modalRenombrarVisible, setModalRenombrarVisible] = useState(false);
  const [nuevoNombreDispositivo, setNuevoNombreDispositivo] = useState('');
  const [guardandoNombreDispositivo, setGuardandoNombreDispositivo] = useState(false);

  const [modalEditarNombreUsuario, setModalEditarNombreUsuario] = useState(false);
  const [nuevoNombreUsuario, setNuevoNombreUsuario] = useState('');
  const [guardandoNombreUsuario, setGuardandoNombreUsuario] = useState(false);

  const [modalPinVisible, setModalPinVisible] = useState(false);
  const [nuevoPin, setNuevoPin] = useState('');
  const [guardandoPin, setGuardandoPin] = useState(false);

  const [sincronizando, setSincronizando] = useState(false);

  /**
   * Solicita confirmación al usuario para desvincular el Pocket Locker actual
   * y purga las credenciales guardadas en SecureStore.
   */
  const handleDesvincular = useCallback(() => {
    Alert.alert(
      'Desvincular dispositivo',
      '¿Estás seguro de que deseas eliminar la vinculación con este Pocket Locker? Se borrará la configuración y el PIN seguro guardado en este teléfono.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desvincular',
          style: 'destructive',
          onPress: async () => {
            try {
              await desvincularDispositivo();
              Alert.alert('Desvinculado', 'El dispositivo ha sido desvinculado con éxito.');
              router.replace('/(tabs)');
            } catch {
              Alert.alert('Error', 'No se pudo desvincular el dispositivo.');
            }
          },
        },
      ]
    );
  }, [desvincularDispositivo]);

  /** Abre el modal para modificar el nombre del dispositivo */
  const abrirRenombrar = useCallback(() => {
    setNuevoNombreDispositivo(deviceName || 'Pocket Locker');
    setModalRenombrarVisible(true);
  }, [deviceName]);

  /** Guarda el nuevo nombre asignado al dispositivo en el almacenamiento local */
  const guardarNuevoNombreDispositivo = useCallback(async () => {
    const nombre = nuevoNombreDispositivo.trim();
    if (!nombre) {
      Alert.alert('Nombre requerido', 'El nombre del dispositivo no puede estar vacío.');
      return;
    }
    setGuardandoNombreDispositivo(true);
    try {
      await renombrarDispositivo(nombre);
      setModalRenombrarVisible(false);
      Alert.alert('Actualizado', 'Nombre del dispositivo actualizado con éxito.');
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el nombre.');
    } finally {
      setGuardandoNombreDispositivo(false);
    }
  }, [nuevoNombreDispositivo, renombrarDispositivo]);

  /** Abre el modal para modificar el nombre del usuario */
  const abrirEditarNombre = useCallback(() => {
    setNuevoNombreUsuario(userName || '');
    setModalEditarNombreUsuario(true);
  }, [userName]);

  /** Guarda el nuevo nombre de usuario en el contexto y almacenamiento */
  const guardarNuevoNombreUsuario = useCallback(async () => {
    const nombre = nuevoNombreUsuario.trim();
    if (!nombre) {
      Alert.alert('Nombre requerido', 'Tu nombre no puede estar vacío.');
      return;
    }
    setGuardandoNombreUsuario(true);
    try {
      await guardarNombreUsuario(nombre);
      setModalEditarNombreUsuario(false);
      Alert.alert('Actualizado', 'Tu nombre de usuario se ha guardado.');
    } catch {
      Alert.alert('Error', 'No se pudo guardar el nombre.');
    } finally {
      setGuardandoNombreUsuario(false);
    }
  }, [nuevoNombreUsuario, guardarNombreUsuario]);

  /**
   * Solicita autenticación biométrica (huella dactilar) antes de permitir visualizar
   * y editar el PIN de seguridad del dispositivo. Accesible para cualquier usuario normal o administrador.
   */
  const abrirEditarPin = useCallback(async () => {
    const auth = await BiometricService.autenticarParaEditarPin();
    if (!auth.exito) {
      if (auth.requiereBuild) {
        Alert.alert(
          'Biometría no disponible en esta versión',
          'El lector de huella dactilar se habilitará al compilar una nueva versión instalable (EAS Build). ¿Deseas acceder a editar el PIN ahora?',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Editar PIN',
              onPress: () => {
                setNuevoPin(devicePin || '2415');
                setModalPinVisible(true);
              },
            },
          ]
        );
        return;
      }
      if (!auth.cancelado && auth.mensajeError) {
        Alert.alert('Autenticación biométrica requerida', auth.mensajeError);
      }
      return;
    }

    setNuevoPin(devicePin || '2415');
    setModalPinVisible(true);
  }, [devicePin]);

  /** Valida y persiste el nuevo PIN de seguridad cifrado en SecureStore */
  const guardarNuevoPin = useCallback(async () => {
    const pinLimpio = nuevoPin.trim().toUpperCase();
    if (!pinLimpio) {
      Alert.alert('PIN requerido', 'Introduce el nuevo PIN de seguridad.');
      return;
    }

    const val = parsearYValidarPin(pinLimpio);
    if (!val.esValido) {
      Alert.alert('PIN inválido', val.mensajeError || 'El formato del PIN no es válido.');
      return;
    }

    setGuardandoPin(true);
    try {
      await actualizarPinDispositivo(pinLimpio);
      setModalPinVisible(false);
      Alert.alert('PIN actualizado', 'El nuevo PIN se ha guardado de forma segura.');
    } catch {
      Alert.alert('Error', 'No se pudo guardar el nuevo PIN.');
    } finally {
      setGuardandoPin(false);
    }
  }, [nuevoPin, actualizarPinDispositivo]);

  /** Inicia la sincronización de reloj en tiempo real y permisos con el microcontrolador ESP32 */
  const handleSincronizar = useCallback(async () => {
    setSincronizando(true);
    try {
      await sincronizarConLocker();
      Alert.alert('Sincronización completada', 'Se han actualizado los datos con el Pocket Locker.');
    } catch {
      Alert.alert(
        'Aviso de sincronización',
        'No se pudo comunicar con el locker. Asegúrate de estar cerca y conectado.'
      );
    } finally {
      setSincronizando(false);
    }
  }, [sincronizarConLocker]);

  return (
    <SafeAreaView style={tw`flex-1 bg-beige-bg`} edges={['top']}>
      <ScrollView contentContainerStyle={tw`p-5 pb-10 flex-grow`}>
        {/* Título de la pantalla */}
        <Text style={tw`text-2xl font-bold text-azul-oscuro mb-1`}>Ajustes</Text>
        <Text style={tw`text-sm text-texto-secundario mb-6`}>
          Configura tus preferencias, dispositivo y credenciales
        </Text>

        {/* Sección: Usuario */}
        <Text style={tw`text-xs font-bold text-texto-secundario uppercase tracking-wider mb-2 ml-1`}>
          Usuario
        </Text>
        <UsuarioCard
          userName={userName}
          userRole={userRole}
          onEditarNombre={abrirEditarNombre}
          onIrAdmin={() => router.push('/admin')}
        />

        {/* Sección: Dispositivo Vinculado */}
        <Text style={tw`text-xs font-bold text-texto-secundario uppercase tracking-wider mb-2 ml-1`}>
          Dispositivo Vinculado
        </Text>
        <DispositivoCard
          deviceMac={deviceMac}
          deviceName={deviceName}
          devicePin={devicePin}
          onRenombrar={abrirRenombrar}
          onEditarPin={abrirEditarPin}
          onDesvincular={handleDesvincular}
        />

        {/* Sección: Preferencias y Diagnóstico */}
        <Text style={tw`text-xs font-bold text-texto-secundario uppercase tracking-wider mb-2 ml-1`}>
          Preferencias
        </Text>
        <PreferenciasCard
          sincronizando={sincronizando}
          onSincronizar={handleSincronizar}
          onIrLogs={() => router.push('/logs')}
        />

        {/* Info de la aplicación */}
        <AppInfoCard />
      </ScrollView>

      {/* Modales modulares */}
      <ModalRenombrar
        visible={modalRenombrarVisible}
        titulo="Renombrar Dispositivo"
        subtitulo="Introduce un nombre descriptivo para identificar tu Pocket Locker:"
        label="Nombre del dispositivo"
        valor={nuevoNombreDispositivo}
        setValor={setNuevoNombreDispositivo}
        guardando={guardandoNombreDispositivo}
        onCancel={() => setModalRenombrarVisible(false)}
        onConfirm={guardarNuevoNombreDispositivo}
      />

      <ModalRenombrar
        visible={modalEditarNombreUsuario}
        titulo="Modificar Tu Nombre"
        subtitulo="Este nombre se enviará al Pocket Locker al sincronizar para registrar tus aperturas:"
        label="Nombre de usuario"
        valor={nuevoNombreUsuario}
        setValor={setNuevoNombreUsuario}
        guardando={guardandoNombreUsuario}
        onCancel={() => setModalEditarNombreUsuario(false)}
        onConfirm={guardarNuevoNombreUsuario}
      />

      <ModalEditarPin
        visible={modalPinVisible}
        pin={nuevoPin}
        setPin={setNuevoPin}
        guardando={guardandoPin}
        onCancel={() => setModalPinVisible(false)}
        onConfirm={guardarNuevoPin}
      />
    </SafeAreaView>
  );
}
