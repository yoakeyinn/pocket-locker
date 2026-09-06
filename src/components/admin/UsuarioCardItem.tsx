import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { UsuarioAdmin } from '../../context/BluetoothContext';
import tw from '../../styles/tailwind';

/**
 * Propiedades del componente UsuarioCardItem.
 */
interface UsuarioCardItemProps {
  /** Información del usuario administrado (nombre, MAC, permisos, días restantes, estado) */
  item: UsuarioAdmin;
  /** Callback invocado para reactivar y desbloquear a un usuario */
  onDesbloquear: (u: UsuarioAdmin) => void;
  /** Callback invocado para abrir el modal de edición de permisos y días de validez */
  onEditar: (u: UsuarioAdmin) => void;
  /** Callback invocado para dar de baja o eliminar el registro de este usuario en el ESP32 */
  onEliminar: (u: UsuarioAdmin) => void;
}

/**
 * Tarjeta individual para visualización y gestión de un usuario registrado en la memoria del ESP32.
 * Presenta el nombre, dirección MAC, badges de permisos (peatonal y/o garaje), indicador de validez temporal,
 * y botones de acción rápida para desbloqueo, modificación y revocación.
 * Estilizado íntegramente con clases utilitarias de Tailwind CSS.
 */
export const UsuarioCardItem: React.FC<UsuarioCardItemProps> = ({
  item,
  onDesbloquear,
  onEditar,
  onEliminar,
}) => {
  return (
    <View style={tw`bg-beige-card rounded-3xl p-5 shadow-sm border border-stone-200/60 mb-4`}>
      {/* Cabecera del usuario */}
      <View style={tw`flex-row items-center justify-between`}>
        <View style={tw`flex-1 mr-2`}>
          <Text style={tw`text-base font-bold text-azul-oscuro`} numberOfLines={1}>
            {item.nombre}
          </Text>
          <Text style={tw`text-xs font-mono text-texto-secundario mt-0.5`}>{item.mac}</Text>
        </View>
        <View
          style={tw`px-2.5 py-1 rounded-full ${
            item.bloqueado ? 'bg-red-100 border border-red-200' : 'bg-green-100 border border-green-200'
          }`}
        >
          <Text
            style={tw`text-2xs font-extrabold tracking-wider ${
              item.bloqueado ? 'text-error-rojo' : 'text-exito-verde'
            }`}
          >
            {item.bloqueado ? 'BLOQUEADO' : 'ACTIVO'}
          </Text>
        </View>
      </View>

      {/* Fila de permisos y validez */}
      <View style={tw`flex-row flex-wrap gap-2 my-3.5`}>
        {/* Peatonal */}
        <View
          style={tw`flex-row items-center px-2.5 py-1 rounded-xl border ${
            item.peatonal ? 'bg-azul-claro border-blue-200' : 'bg-stone-100 border-stone-200'
          }`}
        >
          <MaterialIcons
            name="door-front"
            size={14}
            color={item.peatonal ? '#2C5F8A' : '#888888'}
          />
          <Text
            style={tw`text-xs font-semibold ml-1 ${
              item.peatonal ? 'text-azul-primario' : 'text-stone-500'
            }`}
          >
            Peatonal
          </Text>
        </View>

        {/* Garaje */}
        <View
          style={tw`flex-row items-center px-2.5 py-1 rounded-xl border ${
            item.garaje ? 'bg-azul-claro border-blue-200' : 'bg-stone-100 border-stone-200'
          }`}
        >
          <MaterialIcons
            name="garage"
            size={14}
            color={item.garaje ? '#2C5F8A' : '#888888'}
          />
          <Text
            style={tw`text-xs font-semibold ml-1 ${
              item.garaje ? 'text-azul-primario' : 'text-stone-500'
            }`}
          >
            Garaje
          </Text>
        </View>

        {/* Días */}
        <View style={tw`flex-row items-center px-2.5 py-1 rounded-xl bg-stone-100 border border-stone-200`}>
          <MaterialIcons name="schedule" size={14} color="#666666" />
          <Text style={tw`text-xs font-semibold text-stone-600 ml-1`}>
            {item.diasRestantes === -1
              ? 'Indefinido'
              : item.diasRestantes === 0
              ? 'Expirado hoy'
              : `${item.diasRestantes} días`}
          </Text>
        </View>
      </View>

      {/* Fila de acciones */}
      <View style={tw`flex-row justify-end gap-2 pt-3 border-t border-stone-100`}>
        {item.bloqueado && (
          <TouchableOpacity
            style={tw`flex-row items-center bg-exito-verde px-3 py-1.5 rounded-xl shadow-xs`}
            onPress={() => onDesbloquear(item)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="lock-open" size={15} color="#FFFFFF" />
            <Text style={tw`text-xs font-bold text-white ml-1`}>Desbloquear</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={tw`flex-row items-center bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl`}
          onPress={() => onEditar(item)}
          activeOpacity={0.8}
        >
          <MaterialIcons name="edit" size={15} color="#2C5F8A" />
          <Text style={tw`text-xs font-bold text-azul-primario ml-1`}>Editar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={tw`flex-row items-center bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl`}
          onPress={() => onEliminar(item)}
          activeOpacity={0.8}
        >
          <MaterialIcons name="delete" size={15} color="#E85D5D" />
          <Text style={tw`text-xs font-bold text-error-rojo ml-1`}>Eliminar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default UsuarioCardItem;
