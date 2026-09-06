import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBluetooth, UsuarioAdmin } from '../context/BluetoothContext';
import UsuarioCardItem from '../components/admin/UsuarioCardItem';
import ModalEditarUsuario from '../components/admin/ModalEditarUsuario';
import tw from '../styles/tailwind';

/**
 * Pantalla de Administración de Usuarios de Pocket Locker.
 * Accesible únicamente para el usuario con rol Administrador (PIN 2415).
 * Permite listar usuarios registrados en el ESP32, desbloquear accesos caducados
 * y modificar días de validez y permisos de apertura.
 */
export default function AdminScreen() {
  const {
    obtenerListaUsuarios,
    desbloquearUsuario,
    modificarUsuario,
    eliminarUsuario,
  } = useBluetooth();

  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [refrescando, setRefrescando] = useState<boolean>(false);

  // Estados para modal de edición de usuario
  const [modalEditarVisible, setModalEditarVisible] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioAdmin | null>(null);
  const [editDias, setEditDias] = useState('0');
  const [editPeatonal, setEditPeatonal] = useState(true);
  const [editGaraje, setEditGaraje] = useState(true);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  /** Consulta la lista de usuarios registrados directamente desde la NVS del ESP32 vía BLE */
  const cargarLista = useCallback(async () => {
    setCargando(true);
    try {
      const lista = await obtenerListaUsuarios();
      setUsuarios(lista);
    } catch {
      Alert.alert('Error', 'No se pudo obtener la lista de usuarios del ESP32.');
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, [obtenerListaUsuarios]);

  useEffect(() => {
    cargarLista();
  }, [cargarLista]);

  /** Envía comando BLE al microcontrolador para reactivar el acceso de un usuario bloqueado */
  const handleDesbloquear = useCallback(
    async (u: UsuarioAdmin) => {
      try {
        const ok = await desbloquearUsuario(u.mac);
        if (ok) {
          Alert.alert('Usuario Desbloqueado', `Se ha reactivado el acceso para ${u.nombre}.`);
          cargarLista();
        } else {
          Alert.alert('Error', 'El ESP32 no pudo procesar el desbloqueo.');
        }
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'Fallo al desbloquear usuario.');
      }
    },
    [desbloquearUsuario, cargarLista]
  );

  /** Carga los datos del usuario en el formulario y abre el modal de edición */
  const abrirModalEditar = (u: UsuarioAdmin) => {
    setUsuarioEditando(u);
    setEditDias(u.diasRestantes >= 0 ? u.diasRestantes.toString() : '0');
    setEditPeatonal(u.peatonal);
    setEditGaraje(u.garaje);
    setModalEditarVisible(true);
  };

  /** Valida y transmite los nuevos permisos y días de caducidad al firmware del ESP32 */
  const guardarCambiosUsuario = async () => {
    if (!usuarioEditando) return;
    const diasNum = parseInt(editDias.trim() || '0', 10);
    if (isNaN(diasNum) || diasNum < 0 || diasNum > 99) {
      Alert.alert('Días inválidos', 'Introduce un número de días entre 0 (indefinido) y 99.');
      return;
    }
    if (!editPeatonal && !editGaraje) {
      Alert.alert('Permiso requerido', 'Debes conceder al menos acceso peatonal o de garaje.');
      return;
    }

    setGuardandoEdicion(true);
    try {
      const ok = await modificarUsuario(usuarioEditando.mac, diasNum, editPeatonal, editGaraje);
      if (ok) {
        setModalEditarVisible(false);
        Alert.alert('Actualizado', `Los datos de ${usuarioEditando.nombre} han sido actualizados.`);
        cargarLista();
      } else {
        Alert.alert('Error', 'No se pudieron guardar los cambios en el ESP32.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Fallo al actualizar usuario.');
    } finally {
      setGuardandoEdicion(false);
    }
  };

  /** Confirma y envía el comando de purga definitiva del usuario en el ESP32 */
  const handleEliminar = (u: UsuarioAdmin) => {
    Alert.alert(
      'Eliminar usuario',
      `¿Deseas eliminar permanentemente a ${u.nombre} (${u.mac}) de la base de datos del ESP32?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const ok = await eliminarUsuario(u.mac);
              if (ok) {
                Alert.alert('Eliminado', 'Usuario eliminado de la base de datos.');
                cargarLista();
              } else {
                Alert.alert('Error', 'No se pudo eliminar el usuario.');
              }
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Error eliminando usuario.');
            }
          },
        },
      ]
    );
  };

  const renderUsuarioItem = ({ item }: { item: UsuarioAdmin }) => {
    return (
      <UsuarioCardItem
        item={item}
        onDesbloquear={handleDesbloquear}
        onEditar={abrirModalEditar}
        onEliminar={handleEliminar}
      />
    );
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-beige-bg`} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={tw`flex-row items-center justify-between px-5 py-3.5 bg-beige-bg border-b border-stone-200/60`}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={tw`w-10 h-10 items-center justify-center rounded-xl bg-white shadow-sm border border-stone-200`}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={22} color="#1A3A5C" />
        </TouchableOpacity>
        <Text style={tw`text-lg font-bold text-azul-oscuro`}>Base de Datos ESP32</Text>
        <TouchableOpacity
          onPress={cargarLista}
          style={tw`w-10 h-10 items-center justify-center rounded-xl bg-white shadow-sm border border-stone-200`}
          activeOpacity={0.7}
        >
          <MaterialIcons name="refresh" size={22} color="#2C5F8A" />
        </TouchableOpacity>
      </View>

      <View style={tw`flex-1 p-5`}>
        <Text style={tw`text-xs text-texto-secundario mb-5 leading-4`}>
          Usuarios y dispositivos móviles registrados en la memoria flash no volátil del locker.
        </Text>

        {cargando ? (
          <View style={tw`flex-1 items-center justify-center py-20`}>
            <ActivityIndicator size="large" color="#2C5F8A" />
            <Text style={tw`text-sm text-texto-secundario mt-3 font-semibold`}>
              Leyendo usuarios del locker...
            </Text>
          </View>
        ) : (
          <FlatList
            data={usuarios}
            keyExtractor={(item) => item.mac}
            renderItem={renderUsuarioItem}
            contentContainerStyle={usuarios.length === 0 ? tw`flex-grow justify-center` : tw`pb-6`}
            refreshing={refrescando}
            onRefresh={() => {
              setRefrescando(true);
              cargarLista();
            }}
            ListEmptyComponent={
              <View style={tw`items-center justify-center py-16 px-6 bg-beige-card rounded-3xl border border-dashed border-stone-300`}>
                <MaterialIcons name="group-off" size={40} color="#6B6B6B" />
                <Text style={tw`text-base font-bold text-azul-oscuro text-center mt-3`}>
                  No hay usuarios registrados
                </Text>
                <Text style={tw`text-xs text-texto-secundario text-center mt-1 leading-4`}>
                  Los usuarios se registrarán automáticamente al sincronizar por primera vez.
                </Text>
              </View>
            }
          />
        )}
      </View>

      <ModalEditarUsuario
        visible={modalEditarVisible}
        usuario={usuarioEditando}
        editDias={editDias}
        setEditDias={setEditDias}
        editPeatonal={editPeatonal}
        setEditPeatonal={setEditPeatonal}
        editGaraje={editGaraje}
        setEditGaraje={setEditGaraje}
        guardando={guardandoEdicion}
        onCancel={() => setModalEditarVisible(false)}
        onConfirm={guardarCambiosUsuario}
      />
    </SafeAreaView>
  );
}
