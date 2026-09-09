import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useBluetooth, BluetoothService } from '../services/BluetoothService';
import StorageService, {
  AppLockConfig,
  AppCustomPreferences,
  BiometricService,
} from '../services/StorageService';
import tw, { APP_VERSION } from '../styles';

export const AppInfoCard: React.FC = () => (
  <View style={tw`items-center justify-center py-6 mb-8`}>
    <Text style={tw`text-xs font-bold text-azul-primario tracking-wider`}>Pocket Locker v{APP_VERSION}</Text>
    <Text style={tw`text-xs text-texto-secundario mt-1`}>ESP32 Multi-User & Secure Storage Edition</Text>
  </View>
);

const ICONOS_DISPONIBLES = [
  { id: 'clasico', nombre: 'Azul Clásico', color: '#2C5F8A', iconName: 'lock' as const },
  { id: 'esmeralda', nombre: 'Esmeralda', color: '#059669', iconName: 'shield' as const },
  { id: 'stealth', nombre: 'Stealth Oscuro', color: '#1F2937', iconName: 'vpn-key' as const },
  { id: 'neon', nombre: 'Cyber Neón', color: '#6366F1', iconName: 'fingerprint' as const },
  { id: 'dorado', nombre: 'Dorado Premium', color: '#D97706', iconName: 'verified-user' as const },
];

const PALETAS_TEMA = [
  { id: 'azul', nombre: 'Azul Clásico', hex: '#2C5F8A' },
  { id: 'esmeralda', nombre: 'Esmeralda Forestal', hex: '#059669' },
  { id: 'amatista', nombre: 'Amatista Púrpura', hex: '#7C3AED' },
  { id: 'ambar', nombre: 'Puesta de Sol Ámbar', hex: '#D97706' },
  { id: 'oled', nombre: 'Medianoche OLED', hex: '#111827' },
];

export default function AjustesScreen() {
  const {
    deviceName,
    deviceMac,
    status,
    conectar,
    desconectar,
    desvincularDispositivo,
    actualizarNombreDispositivo,
  } = useBluetooth();

  const [procesando, setProcesando] = useState(false);
  const [editandoNombreLocker, setEditandoNombreLocker] = useState(false);
  const [nombreLockerInput, setNombreLockerInput] = useState(deviceName || 'Pocket Locker');

  const [soportaBiometria, setSoportaBiometria] = useState(false);
  const [tieneBiometriaRegistrada, setTieneBiometriaRegistrada] = useState(false);
  const [appLock, setAppLock] = useState<AppLockConfig>({ enabled: false, mode: 'pin', pin: '' });
  const [editandoPinApp, setEditandoPinApp] = useState(false);
  const [pinAppInput, setPinAppInput] = useState('');

  const [appPrefs, setAppPrefs] = useState<AppCustomPreferences>({
    appName: 'Pocket Locker',
    appIcon: 'clasico',
    themeMode: 'light',
    themeColor: 'azul',
  });
  const [editandoAliasApp, setEditandoAliasApp] = useState(false);
  const [aliasAppInput, setAliasAppInput] = useState('Pocket Locker');

  useEffect(() => {
    if (deviceName) setNombreLockerInput(deviceName);
  }, [deviceName]);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const [soporta, registrada, lockConfig, prefs] = await Promise.all([
          BiometricService.soportaBiometria().catch(() => false),
          BiometricService.tieneBiometriaRegistrada().catch(() => false),
          StorageService.getAppLockConfig().catch(() => ({ enabled: false, mode: 'pin' as const, pin: '' })),
          StorageService.getAppCustomPreferences().catch(() => ({
            appName: 'Pocket Locker',
            appIcon: 'clasico',
            themeMode: 'light' as const,
            themeColor: 'azul',
          })),
        ]);
        if (!activo) return;
        setSoportaBiometria(soporta);
        setTieneBiometriaRegistrada(registrada);
        setAppLock(lockConfig);
        setAppPrefs(prefs);
        setAliasAppInput(prefs.appName || 'Pocket Locker');
      } catch {}
    })();
    return () => { activo = false; };
  }, []);

  const handleToggleConexion = useCallback(async () => {
    setProcesando(true);
    try {
      if (status === 'connected') {
        await desconectar();
        await BluetoothService.abrirAjustesBluetooth();
      } else {
        await conectar();
      }
    } catch {
      Alert.alert(
        'No se pudo conectar',
        'No se ha podido establecer conexión con el Pocket Locker. Asegúrate de que esté encendido y dentro del alcance.'
      );
    } finally {
      setProcesando(false);
    }
  }, [status, conectar, desconectar]);

  const handleGuardarNombreLocker = useCallback(async () => {
    const limpio = nombreLockerInput.trim();
    if (!limpio) {
      Alert.alert('Nombre inválido', 'El nombre del dispositivo no puede estar vacío.');
      return;
    }
    try {
      if (actualizarNombreDispositivo) {
        await actualizarNombreDispositivo(limpio);
      } else {
        await StorageService.saveDeviceName(limpio);
      }
      setEditandoNombreLocker(false);
    } catch {
      Alert.alert('Error', 'No se pudo guardar el nombre del dispositivo.');
    }
  }, [nombreLockerInput, actualizarNombreDispositivo]);

  const handleToggleAppLock = useCallback(
    async (activar: boolean) => {
      const nuevaConfig: AppLockConfig = activar
        ? {
            enabled: true,
            mode: soportaBiometria && tieneBiometriaRegistrada ? 'biometric' : 'pin',
            pin: appLock.pin || '1234',
          }
        : { ...appLock, enabled: false };
      setAppLock(nuevaConfig);
      await StorageService.saveAppLockConfig(nuevaConfig).catch(() => {});
    },
    [soportaBiometria, tieneBiometriaRegistrada, appLock]
  );

  const handleCambiarModoBloqueo = useCallback(
    async (modo: 'biometric' | 'pin') => {
      if (modo === 'biometric' && (!soportaBiometria || !tieneBiometriaRegistrada)) {
        Alert.alert(
          'Biometría no disponible',
          'Tu dispositivo no dispone de lector de huellas o no tienes ninguna huella configurada en los Ajustes del móvil.'
        );
        return;
      }
      const nuevaConfig: AppLockConfig = { ...appLock, mode: modo };
      setAppLock(nuevaConfig);
      await StorageService.saveAppLockConfig(nuevaConfig).catch(() => {});
    },
    [appLock, soportaBiometria, tieneBiometriaRegistrada]
  );

  const handleGuardarPinApp = useCallback(async () => {
    const limpio = pinAppInput.trim();
    if (limpio.length < 4) {
      Alert.alert('PIN incompleto', 'Introduce un código de al menos 4 dígitos.');
      return;
    }
    const nuevaConfig: AppLockConfig = { ...appLock, pin: limpio };
    setAppLock(nuevaConfig);
    await StorageService.saveAppLockConfig(nuevaConfig).catch(() => {});
    setEditandoPinApp(false);
    Alert.alert('PIN guardado', 'La contraseña de la app ha sido configurada con éxito.');
  }, [pinAppInput, appLock]);

  const actualizarPref = useCallback(
    async <K extends keyof AppCustomPreferences>(key: K, value: AppCustomPreferences[K]) => {
      setAppPrefs((prev) => {
        const next = { ...prev, [key]: value };
        StorageService.saveAppCustomPreferences({ [key]: value }).catch(() => {});
        return next;
      });
    },
    []
  );

  const handleGuardarAliasApp = useCallback(() => {
    const limpio = aliasAppInput.trim();
    if (limpio) {
      actualizarPref('appName', limpio);
      setEditandoAliasApp(false);
    }
  }, [aliasAppInput, actualizarPref]);

  const handleDesvincular = useCallback(() => {
    Alert.alert(
      'Desvincular dispositivo',
      '¿Estás seguro de que deseas eliminar la vinculación con este Pocket Locker? Se borrarán los datos del dispositivo y la app se cerrará.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desvincular y Salir',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcesando(true);
              await desconectar().catch(() => {});
              if (deviceMac) await BluetoothService.desvincularDispositivo(deviceMac).catch(() => {});
              await desvincularDispositivo();
              BackHandler.exitApp();
            } catch {
              Alert.alert('Error', 'No se pudo desvincular el dispositivo.');
            } finally {
              setProcesando(false);
            }
          },
        },
      ]
    );
  }, [deviceMac, desconectar, desvincularDispositivo]);

  const estaConectado = status === 'connected';

  return (
    <SafeAreaView style={tw`flex-1 bg-beige-bg`} edges={['top']}>
      <ScrollView
        contentContainerStyle={tw`p-5 pb-16 flex-grow`}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={tw`flex-row items-center justify-between mb-4`}>
          <TouchableOpacity
            testID="btn-volver-ajustes"
            onPress={() => {
              if (typeof router.canGoBack === 'function' && router.canGoBack()) {
                router.back();
              } else {
                router.replace('/control');
              }
            }}
            style={tw`w-10 h-10 items-center justify-center rounded-xl bg-white shadow-sm border border-stone-200`}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={22} color="#1A3A5C" />
          </TouchableOpacity>
          <Text style={tw`text-xl font-bold text-azul-oscuro`}>Ajustes</Text>
          <View style={tw`w-10`} />
        </View>

        <Text style={tw`text-sm text-texto-secundario mb-6`}>
          Gestión de conexión, seguridad y personalización
        </Text>

        {/* 1. SECCIÓN: DISPOSITIVO VINCULADO */}
        {deviceMac ? (
          <View style={tw`bg-beige-card rounded-3xl p-5 shadow-sm border border-stone-200/60 mb-6`}>
            <View style={tw`flex-row items-center justify-between py-2`}>
              <View style={tw`w-12 h-12 rounded-2xl bg-azul-claro items-center justify-center mr-3.5`}>
                <MaterialIcons name="lock" size={24} color="#2C5F8A" />
              </View>
              <View style={tw`flex-1 mr-2`}>
                <Text style={tw`text-xs font-bold text-texto-secundario uppercase tracking-wider`}>
                  Dispositivo Vinculado
                </Text>

                {editandoNombreLocker ? (
                  <View style={tw`flex-row items-center mt-1.5`}>
                    <TextInput
                      style={tw`flex-1 bg-white border border-stone-300 rounded-xl px-3 py-1.5 text-sm font-bold text-azul-oscuro`}
                      value={nombreLockerInput}
                      onChangeText={setNombreLockerInput}
                      autoFocus
                    />
                    <TouchableOpacity
                      onPress={handleGuardarNombreLocker}
                      style={tw`ml-2 px-3 py-2 bg-azul-primario rounded-xl`}
                    >
                      <MaterialIcons name="check" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setNombreLockerInput(deviceName || 'Pocket Locker');
                        setEditandoNombreLocker(false);
                      }}
                      style={tw`ml-1 px-2 py-2 bg-stone-200 rounded-xl`}
                    >
                      <MaterialIcons name="close" size={18} color="#4B5563" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={tw`flex-row items-center mt-0.5`}>
                    <Text style={tw`text-lg font-bold text-azul-oscuro mr-2`} numberOfLines={1}>
                      {deviceName || 'Pocket Locker'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setEditandoNombreLocker(true)}
                      style={tw`p-1 rounded-lg bg-stone-100`}
                    >
                      <MaterialIcons name="edit" size={15} color="#2C5F8A" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View
                style={tw`flex-row items-center px-2.5 py-1 rounded-full ${
                  estaConectado ? 'bg-emerald-100' : 'bg-stone-200'
                }`}
              >
                <View
                  style={tw`w-2 h-2 rounded-full mr-1.5 ${
                    estaConectado ? 'bg-emerald-600' : 'bg-stone-500'
                  }`}
                />
                <Text
                  style={tw`text-xs font-bold ${
                    estaConectado ? 'text-emerald-800' : 'text-stone-600'
                  }`}
                >
                  {estaConectado ? 'Conectado' : 'Desconectado'}
                </Text>
              </View>
            </View>

            <View style={tw`h-px bg-stone-100 my-3`} />

            <View style={tw`flex-row items-center py-1.5`}>
              <View style={tw`w-8 h-8 rounded-xl bg-stone-100 items-center justify-center mr-3`}>
                <MaterialIcons name="fingerprint" size={18} color="#6B6B6B" />
              </View>
              <View style={tw`flex-1`}>
                <Text style={tw`text-xs font-bold text-texto-secundario uppercase tracking-wider`}>
                  Dirección MAC
                </Text>
                <Text style={tw`text-xs font-mono text-stone-700 mt-0.5`}>{deviceMac}</Text>
              </View>
            </View>

            <View style={tw`h-px bg-stone-100 my-3`} />

            <TouchableOpacity
              testID="btn-toggle-conexion"
              style={tw`flex-row items-center justify-center py-3.5 rounded-2xl mb-3 ${
                estaConectado ? 'bg-amber-50 border border-amber-300' : 'bg-azul-primario shadow-sm'
              }`}
              onPress={handleToggleConexion}
              disabled={procesando}
              activeOpacity={0.85}
            >
              {procesando ? (
                <ActivityIndicator size="small" color={estaConectado ? '#D97706' : '#FFFFFF'} />
              ) : (
                <View style={tw`flex-row items-center justify-center`}>
                  <MaterialIcons
                    name={estaConectado ? 'bluetooth-disabled' : 'bluetooth-connected'}
                    size={20}
                    color={estaConectado ? '#B45309' : '#FFFFFF'}
                  />
                  <Text style={tw`text-sm font-bold ml-2 ${estaConectado ? 'text-amber-800' : 'text-white'}`}>
                    {estaConectado ? 'Desconectar del Locker' : 'Conectar al Locker'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              testID="btn-desvincular"
              style={tw`flex-row items-center justify-center py-3.5 bg-red-50 rounded-2xl border border-red-200/80`}
              onPress={handleDesvincular}
              activeOpacity={0.8}
            >
              <MaterialIcons name="delete-outline" size={20} color="#E85D5D" />
              <Text style={tw`text-sm font-bold text-error-rojo ml-2`}>Desvincular Dispositivo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={tw`bg-beige-card rounded-3xl p-6 shadow-sm border border-dashed border-stone-300 items-center justify-center mb-6`}>
            <MaterialIcons name="phonelink-erase" size={40} color="#6B6B6B" />
            <Text style={tw`text-sm font-bold text-azul-oscuro mt-3 text-center`}>
              Sin dispositivo vinculado
            </Text>
            <Text style={tw`text-xs text-texto-secundario text-center mt-1.5 leading-5 px-4`}>
              No hay ningún Pocket Locker vinculado actualmente en este teléfono.
            </Text>
            <TouchableOpacity
              style={tw`mt-4 py-2.5 px-5 rounded-2xl bg-azul-primario shadow-sm`}
              onPress={() => router.replace('/inicio')}
              activeOpacity={0.85}
            >
              <Text style={tw`text-xs font-bold text-white uppercase tracking-wider`}>
                Buscar Pocket Locker
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 2. SECCIÓN: SEGURIDAD Y BLOQUEO DE LA APP */}
        <View style={tw`bg-beige-card rounded-3xl p-5 shadow-sm border border-stone-200/60 mb-6`}>
          <View style={tw`flex-row items-center justify-between mb-3`}>
            <View style={tw`flex-row items-center`}>
              <View style={tw`w-9 h-9 rounded-xl bg-azul-claro items-center justify-center mr-3`}>
                <MaterialIcons name="security" size={20} color="#2C5F8A" />
              </View>
              <View>
                <Text style={tw`text-sm font-bold text-azul-oscuro`}>Bloqueo de la App</Text>
                <Text style={tw`text-xs text-texto-secundario`}>Exigir clave o huella al abrir</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => handleToggleAppLock(!appLock.enabled)}
              style={tw`w-12 h-7 rounded-full p-0.5 justify-center ${
                appLock.enabled ? 'bg-azul-primario' : 'bg-stone-300'
              }`}
              activeOpacity={0.85}
            >
              <View
                style={tw`w-6 h-6 rounded-full bg-white shadow-sm ${
                  appLock.enabled ? 'self-end' : 'self-start'
                }`}
              />
            </TouchableOpacity>
          </View>

          {appLock.enabled && (
            <View style={tw`pt-3 border-t border-stone-100 mt-2`}>
              <Text style={tw`text-xs font-bold text-texto-secundario uppercase tracking-wider mb-2`}>
                Método de desbloqueo
              </Text>

              <View style={tw`flex-row gap-2 mb-3`}>
                <TouchableOpacity
                  onPress={() => handleCambiarModoBloqueo('biometric')}
                  style={tw`flex-1 flex-row items-center justify-center py-2.5 px-3 rounded-xl border ${
                    appLock.mode === 'biometric'
                      ? 'bg-azul-primario border-azul-primario'
                      : 'bg-white border-stone-200'
                  }`}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name="fingerprint"
                    size={18}
                    color={appLock.mode === 'biometric' ? '#FFFFFF' : '#4B5563'}
                  />
                  <Text
                    style={tw`text-xs font-bold ml-1.5 ${
                      appLock.mode === 'biometric' ? 'text-white' : 'text-stone-700'
                    }`}
                  >
                    Huella / Face
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleCambiarModoBloqueo('pin')}
                  style={tw`flex-1 flex-row items-center justify-center py-2.5 px-3 rounded-xl border ${
                    appLock.mode === 'pin'
                      ? 'bg-azul-primario border-azul-primario'
                      : 'bg-white border-stone-200'
                  }`}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name="pin"
                    size={18}
                    color={appLock.mode === 'pin' ? '#FFFFFF' : '#4B5563'}
                  />
                  <Text
                    style={tw`text-xs font-bold ml-1.5 ${
                      appLock.mode === 'pin' ? 'text-white' : 'text-stone-700'
                    }`}
                  >
                    Código PIN
                  </Text>
                </TouchableOpacity>
              </View>

              {appLock.mode === 'biometric' && !soportaBiometria && (
                <View style={tw`p-2.5 rounded-xl bg-amber-50 border border-amber-200 mb-2`}>
                  <Text style={tw`text-xs text-amber-800`}>
                    Tu versión de móvil no dispone de sensor biométrico. Te recomendamos usar PIN.
                  </Text>
                </View>
              )}

              <View style={tw`bg-white rounded-2xl p-3 border border-stone-200/80`}>
                <View style={tw`flex-row items-center justify-between`}>
                  <View>
                    <Text style={tw`text-xs font-bold text-azul-oscuro`}>PIN de desbloqueo</Text>
                    <Text style={tw`text-xs text-stone-500 font-mono mt-0.5`}>
                      {appLock.pin ? '● ● ● ●' : 'Sin configurar'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={async () => {
                      if (editandoPinApp) {
                        setEditandoPinApp(false);
                      } else {
                        if (soportaBiometria && tieneBiometriaRegistrada) {
                          const res = await BiometricService.autenticarParaEditarPin();
                          if (res.exito) {
                            setPinAppInput(appLock.pin || '');
                            setEditandoPinApp(true);
                          } else if (!res.cancelado) {
                            Alert.alert('Autenticación requerida', res.mensajeError || 'Verificación biométrica no superada.');
                          }
                        } else {
                          setPinAppInput(appLock.pin || '');
                          setEditandoPinApp(true);
                        }
                      }
                    }}
                    style={tw`px-3 py-1.5 rounded-xl bg-azul-claro`}
                  >
                    <Text style={tw`text-xs font-bold text-azul-primario`}>
                      {editandoPinApp ? 'Cerrar' : 'Cambiar PIN'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {editandoPinApp && (
                  <View style={tw`mt-3 pt-3 border-t border-stone-100 flex-row items-center`}>
                    <TextInput
                      style={tw`flex-1 bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-sm font-mono tracking-widest`}
                      keyboardType="numeric"
                      secureTextEntry
                      maxLength={6}
                      value={pinAppInput}
                      onChangeText={setPinAppInput}
                    />
                    <TouchableOpacity
                      onPress={handleGuardarPinApp}
                      style={tw`ml-2 px-4 py-2 bg-azul-primario rounded-xl`}
                    >
                      <Text style={tw`text-xs font-bold text-white`}>Guardar</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        {/* 3. SECCIÓN: PERSONALIZACIÓN DE LA PROPIA APP */}
        <View style={tw`bg-beige-card rounded-3xl p-5 shadow-sm border border-stone-200/60 mb-6`}>
          <View style={tw`flex-row items-center mb-3`}>
            <View style={tw`w-9 h-9 rounded-xl bg-azul-claro items-center justify-center mr-3`}>
              <MaterialIcons name="palette" size={20} color="#2C5F8A" />
            </View>
            <View>
              <Text style={tw`text-sm font-bold text-azul-oscuro`}>Personalización de la App</Text>
              <Text style={tw`text-xs text-texto-secundario`}>Alias e icono en tu pantalla de inicio</Text>
            </View>
          </View>

          <View style={tw`bg-white rounded-2xl p-3.5 border border-stone-200/80 mb-3`}>
            <Text style={tw`text-xs font-bold text-texto-secundario uppercase tracking-wider mb-1`}>
              Nombre de la aplicación
            </Text>
            {editandoAliasApp ? (
              <View style={tw`flex-row items-center mt-1`}>
                <TextInput
                  style={tw`flex-1 bg-stone-50 border border-stone-300 rounded-xl px-3 py-1.5 text-sm font-bold text-azul-oscuro`}
                  value={aliasAppInput}
                  onChangeText={setAliasAppInput}
                  autoFocus
                />
                <TouchableOpacity
                  onPress={handleGuardarAliasApp}
                  style={tw`ml-2 px-3 py-2 bg-azul-primario rounded-xl`}
                >
                  <MaterialIcons name="check" size={18} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setAliasAppInput(appPrefs.appName || 'Pocket Locker');
                    setEditandoAliasApp(false);
                  }}
                  style={tw`ml-1 px-2 py-2 bg-stone-200 rounded-xl`}
                >
                  <MaterialIcons name="close" size={18} color="#4B5563" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={tw`flex-row items-center justify-between mt-0.5`}>
                <Text style={tw`text-base font-bold text-azul-oscuro`}>
                  {appPrefs.appName || 'Pocket Locker'}
                </Text>
                <TouchableOpacity
                  onPress={() => setEditandoAliasApp(true)}
                  style={tw`px-3 py-1.5 rounded-xl bg-azul-claro`}
                >
                  <Text style={tw`text-xs font-bold text-azul-primario`}>Editar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <Text style={tw`text-xs font-bold text-texto-secundario uppercase tracking-wider mb-2`}>
            Icono de la aplicación
          </Text>
          <View style={tw`flex-row flex-wrap gap-2.5`}>
            {ICONOS_DISPONIBLES.map((ico) => {
              const seleccionado = appPrefs.appIcon === ico.id;
              return (
                <TouchableOpacity
                  key={ico.id}
                  onPress={() => actualizarPref('appIcon', ico.id)}
                  style={tw`items-center p-2.5 rounded-2xl border ${
                    seleccionado
                      ? 'bg-azul-claro/60 border-azul-primario shadow-sm'
                      : 'bg-white border-stone-200'
                  }`}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      tw`w-12 h-12 rounded-2xl items-center justify-center mb-1 relative shadow-sm`,
                      { backgroundColor: ico.color },
                    ]}
                  >
                    <MaterialIcons name={ico.iconName} size={24} color="#FFFFFF" />
                    {seleccionado && (
                      <View style={tw`absolute -top-1 -right-1 w-5 h-5 rounded-full bg-azul-primario items-center justify-center border-2 border-white`}>
                        <MaterialIcons name="check" size={12} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                  <Text
                    style={tw`text-xs font-semibold ${
                      seleccionado ? 'text-azul-oscuro' : 'text-stone-600'
                    }`}
                  >
                    {ico.nombre}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 4. SECCIÓN: TEMA Y APARIENCIA */}
        <View style={tw`bg-beige-card rounded-3xl p-5 shadow-sm border border-stone-200/60 mb-6`}>
          <View style={tw`flex-row items-center mb-3`}>
            <View style={tw`w-9 h-9 rounded-xl bg-azul-claro items-center justify-center mr-3`}>
              <MaterialIcons name="brightness-medium" size={20} color="#2C5F8A" />
            </View>
            <View>
              <Text style={tw`text-sm font-bold text-azul-oscuro`}>Tema de la Aplicación</Text>
              <Text style={tw`text-xs text-texto-secundario`}>Modo visual y paletas cromáticas</Text>
            </View>
          </View>

          <View style={tw`flex-row gap-2 mb-4`}>
            {[
              { id: 'light', label: 'Claro', icon: 'light-mode' as const },
              { id: 'dark', label: 'Oscuro', icon: 'dark-mode' as const },
              { id: 'system', label: 'Sistema', icon: 'settings-brightness' as const },
            ].map((modo) => {
              const activo = appPrefs.themeMode === modo.id;
              return (
                <TouchableOpacity
                  key={modo.id}
                  onPress={() => actualizarPref('themeMode', modo.id as any)}
                  style={tw`flex-1 items-center justify-center py-2.5 rounded-2xl border ${
                    activo ? 'bg-azul-primario border-azul-primario' : 'bg-white border-stone-200'
                  }`}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name={modo.icon}
                    size={20}
                    color={activo ? '#FFFFFF' : '#4B5563'}
                  />
                  <Text style={tw`text-xs font-bold mt-1 ${activo ? 'text-white' : 'text-stone-700'}`}>
                    {modo.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={tw`text-xs font-bold text-texto-secundario uppercase tracking-wider mb-2`}>
            Paleta de colores
          </Text>
          <View style={tw`gap-2`}>
            {PALETAS_TEMA.map((paleta) => {
              const activa = appPrefs.themeColor === paleta.id;
              return (
                <TouchableOpacity
                  key={paleta.id}
                  onPress={() => actualizarPref('themeColor', paleta.id)}
                  style={tw`flex-row items-center justify-between p-3 rounded-2xl border bg-white ${
                    activa ? 'border-azul-primario bg-azul-claro/30' : 'border-stone-200/80'
                  }`}
                  activeOpacity={0.8}
                >
                  <View style={tw`flex-row items-center`}>
                    <View
                      style={[
                        tw`w-7 h-7 rounded-xl mr-3 shadow-sm`,
                        { backgroundColor: paleta.hex },
                      ]}
                    />
                    <Text style={tw`text-xs font-bold text-azul-oscuro`}>{paleta.nombre}</Text>
                  </View>
                  {activa && <MaterialIcons name="check-circle" size={20} color="#2C5F8A" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 5. INFORMACIÓN DE VERSIÓN Y SISTEMA */}
        <AppInfoCard />
      </ScrollView>
    </SafeAreaView>
  );
}
