import { t, useIdioma } from '../styles/i18n';
import { useState, useEffect, useCallback } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { AppInfoCard } from '../components/ajustes/AppInfoCard';
import { EditorTexto } from '../components/ajustes/EditorTexto';
import { Boton } from '../components/Boton';
import { Cargando } from '../components/Cargando';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useBluetooth, BluetoothService } from '../services/BluetoothService';
import { BotonIcono, ANCHO_BOTON_ICONO } from '../components/BotonIcono';
import { LogService } from '../services/StorageService';
import { mostrarModal } from '../components/Modal';
import { Preferencias } from '../components/Preferencias';
import { SinDispositivoCard } from '../components/SinDispositivoCard';
import { Text } from '../styles/tipografia/Tipografia';
import tw, { Colors, useTema } from '../styles/styles';
import { borrarDatosApp } from '../services/Reinicio';
import { sincronizarSimulacion } from '../services/Simulacion';

const ETIQUETA = 'text-xs font-bold text-gray uppercase tracking-wider';

export default function AjustesScreen() {
  useTema();
  useIdioma();
  const {
    userName,
    guardarNombreUsuario,
    deviceName,
    deviceMac,
    status,
    conectar,
    desconectar,
    desvincularDispositivo,
    actualizarNombreDispositivo,
  } = useBluetooth();

  const [procesando, setProcesando] = useState(false);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombreInput, setNombreInput] = useState(deviceName || t('pl_app_titulo'));
  const [editandoUsuario, setEditandoUsuario] = useState(false);
  const [usuarioInput, setUsuarioInput] = useState(userName || '');

  useEffect(() => {
    if (deviceName) setNombreInput(deviceName);
  }, [deviceName]);

  const handleToggleConexion = useCallback(async () => {
    setProcesando(true);
    try {
      if (status === 'connected') {
        await desconectar();
      } else {
        await conectar();
      }
    } catch (e) {
      LogService.error('[Ajustes] No se pudo conectar/desconectar desde ajustes', e);
      mostrarModal(
        'No se pudo conectar',
        `No se ha podido establecer conexión con el ${t('pl_app_titulo')}. Asegúrate de que esté encendido y dentro del alcance.`
      );
    } finally {
      setProcesando(false);
    }
  }, [status, conectar, desconectar]);

  const handleGuardarUsuario = useCallback(async () => {
    const limpio = usuarioInput.trim();
    if (!limpio) {
      mostrarModal(t('pl_nombre'), t('pl_login_requerido'));
      return;
    }
    try {
      await guardarNombreUsuario(limpio);
      await sincronizarSimulacion(limpio);
      setEditandoUsuario(false);
    } catch (e) {
      LogService.error('[Ajustes] No se pudo guardar el nombre de usuario', e);
      mostrarModal('Error', 'No se pudo guardar el nombre.');
    }
  }, [usuarioInput, guardarNombreUsuario]);

  const handleGuardarNombre = useCallback(async () => {
    const limpio = nombreInput.trim();
    if (!limpio) {
      mostrarModal('Nombre inválido', 'El nombre del dispositivo no puede estar vacío.');
      return;
    }
    try {
      await actualizarNombreDispositivo(limpio);
      setEditandoNombre(false);
    } catch (e) {
      LogService.error('[Ajustes] No se pudo guardar el nombre del dispositivo', e);
      mostrarModal('Error', 'No se pudo guardar el nombre del dispositivo.');
    }
  }, [nombreInput, actualizarNombreDispositivo]);

  const handleDesvincular = useCallback(() => {
    mostrarModal(
      'Desvincular dispositivo',
      `¿Estás seguro de que deseas eliminar la vinculación con este ${t('pl_app_titulo')}? Se borrarán los datos del dispositivo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desvincular',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcesando(true);
              LogService.info(`[Ajustes] Desvinculando ${deviceMac}`);
              await desconectar().catch((e) => LogService.warn('[Ajustes] desconectar falló al desvincular', e));
              if (deviceMac) {
                await BluetoothService.desvincularDispositivo(deviceMac).catch((e) =>
                  LogService.warn('[Ajustes] desemparejar del sistema falló', e)
                );
              }
              await desvincularDispositivo();
              LogService.info('[Ajustes] Dispositivo desvinculado');
              router.replace('/buscar');
            } catch (e) {
              LogService.error('[Ajustes] No se pudo desvincular el dispositivo', e);
              mostrarModal('Error', 'No se pudo desvincular el dispositivo.');
            } finally {
              setProcesando(false);
            }
          },
        },
      ]
    );
  }, [deviceMac, desconectar, desvincularDispositivo]);

  const handleBorrarDatos = useCallback(() => {
    mostrarModal(t('pl_borrar_datos'), t('pl_borrar_datos_mensaje'), [
      { text: t('pl_cancelar'), style: 'cancel' },
      {
        text: t('pl_borrar'),
        onPress: async () => {
          try {
            setProcesando(true);
            await borrarDatosApp();
            router.replace('/');
          } catch (e) {
            LogService.error('[Ajustes] No se pudieron borrar los datos de la aplicación', e);
            mostrarModal(t('pl_aviso'), t('pl_borrar_datos_error'));
          } finally {
            setProcesando(false);
          }
        },
      },
    ]);
  }, []);

  const estaConectado = status === 'connected';

  return (
    <SafeAreaView style={tw`flex-1 bg-beige`} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={tw`p-5 pb-16 flex-grow`}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={tw`flex-row items-center justify-between mb-4`}>
          <BotonIcono
            conBoton
            testID="btn-volver-ajustes"
            icono="arrow-back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/puertas'))}
          />
          <Text style={tw`font-display text-xl font-bold text-black`}>Ajustes</Text>
          <View style={{ width: ANCHO_BOTON_ICONO }} />
        </View>

        <Text style={tw`text-sm text-gray mb-6`}>Gestión de la conexión con tu dispositivo</Text>

        <View style={tw`bg-white rounded-3xl p-5 shadow-sm border border-silver/60 mb-6`}>
          <Text style={tw`${ETIQUETA}`}>{t('pl_nombre')}</Text>
          {editandoUsuario ? (
            <EditorTexto
              value={usuarioInput}
              onChangeText={setUsuarioInput}
              onGuardar={handleGuardarUsuario}
              onCancelar={() => {
                setUsuarioInput(userName || '');
                setEditandoUsuario(false);
              }}
            />
          ) : (
            <View style={tw`flex-row items-center mt-0.5`}>
              <Text testID="nombre-usuario" style={tw`text-lg font-bold text-black mr-2`} numberOfLines={1}>
                {userName || '-'}
              </Text>
              <TouchableOpacity
                testID="btn-editar-usuario"
                onPress={() => {
                  setUsuarioInput(userName || '');
                  setEditandoUsuario(true);
                }}
                style={tw`p-1 rounded-lg bg-silver`}
              >
                <MaterialIcons name="edit" size={15} color={Colors.black} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {deviceMac ? (
          <View style={tw`bg-white rounded-3xl p-5 shadow-sm border border-silver/60 mb-6`}>
            <View style={tw`flex-row items-center justify-between py-2`}>
              <View style={tw`w-12 h-12 rounded-2xl bg-silver items-center justify-center mr-3.5`}>
                <MaterialIcons name="lock" size={24} color={Colors.black} />
              </View>
              <View style={tw`flex-1 mr-2`}>
                <Text style={tw`${ETIQUETA}`}>Dispositivo Vinculado</Text>

                {editandoNombre ? (
                  <EditorTexto
                    value={nombreInput}
                    onChangeText={setNombreInput}
                    onGuardar={handleGuardarNombre}
                    onCancelar={() => {
                      setNombreInput(deviceName || t('pl_app_titulo'));
                      setEditandoNombre(false);
                    }}
                  />
                ) : (
                  <View style={tw`flex-row items-center mt-0.5`}>
                    <Text style={tw`text-lg font-bold text-black mr-2`} numberOfLines={1}>
                      {deviceName || t('pl_app_titulo')}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setEditandoNombre(true)}
                      style={tw`p-1 rounded-lg bg-silver`}
                    >
                      <MaterialIcons name="edit" size={15} color={Colors.black} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={tw`flex-row items-center px-2.5 py-1 rounded-full bg-silver`}>
                <View style={tw`w-2 h-2 rounded-full mr-1.5 ${estaConectado ? 'bg-black' : 'bg-gray'}`} />
                <Text style={tw`text-xs font-bold ${estaConectado ? 'text-black' : 'text-gray'}`}>
                  {estaConectado ? 'Conectado' : 'Desconectado'}
                </Text>
              </View>
            </View>

            <View style={tw`h-px bg-silver my-3`} />

            <View style={tw`flex-row items-center py-1.5`}>
              <View style={tw`w-8 h-8 rounded-xl bg-silver items-center justify-center mr-3`}>
                <MaterialIcons name="fingerprint" size={18} color={Colors.gray} />
              </View>
              <View style={tw`flex-1`}>
                <Text style={tw`${ETIQUETA}`}>Dirección MAC</Text>
                <Text style={tw`text-xs font-mono text-gray mt-0.5`}>{deviceMac}</Text>
              </View>
            </View>

            <View style={tw`h-px bg-silver my-3`} />

            <TouchableOpacity
              testID="btn-toggle-conexion"
              style={tw`flex-row items-center justify-center py-3.5 rounded-2xl mb-3 ${
                estaConectado ? 'bg-silver border border-silver' : 'bg-black shadow-sm'
              }`}
              onPress={handleToggleConexion}
              disabled={procesando}
              activeOpacity={0.85}
            >
              {procesando ? (
                <Cargando tamano={20} color={estaConectado ? Colors.gray : undefined} />
              ) : (
                <View style={tw`flex-row items-center justify-center`}>
                  <MaterialIcons
                    name={estaConectado ? 'bluetooth-disabled' : 'bluetooth-connected'}
                    size={20}
                    color={estaConectado ? Colors.gray : Colors.white}
                  />
                  <Text style={tw`text-sm font-bold ml-2 ${estaConectado ? 'text-gray' : 'text-white'}`}>
                    {estaConectado ? 'Desconectar del Locker' : 'Conectar al Locker'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              testID="btn-desvincular"
              style={tw`flex-row items-center justify-center py-3.5 bg-silver rounded-2xl border border-red/80`}
              onPress={handleDesvincular}
              activeOpacity={0.8}
            >
              <MaterialIcons name="delete-outline" size={20} color={Colors.red} />
              <Text style={tw`text-sm font-bold text-red ml-2`}>Desvincular Dispositivo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={tw`mb-6`}>
            <SinDispositivoCard onBuscar={() => router.replace('/buscar')} />
          </View>
        )}

        <Text style={[tw`${ETIQUETA} mb-2`]}>{t('pl_login_preferencias')}</Text>
        <View style={tw`mb-6`}>
          <Preferencias />
        </View>

        <View style={tw`mb-2`}>
          <Boton
            rojo
            testID="btn-borrar-datos"
            icono="delete-outline"
            texto={t('pl_borrar_datos')}
            deshabilitado={procesando}
            onPress={handleBorrarDatos}
          />
        </View>

        <AppInfoCard />
      </ScrollView>
    </SafeAreaView>
  );
}
