import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import tw from '../../styles/tailwind';

/**
 * Propiedades del componente UsuarioCard.
 */
interface UsuarioCardProps {
  /** Nombre del usuario activo registrado en la aplicación */
  userName: string | null;
  /** Rol de acceso del usuario ('admin' | 'user') */
  userRole: 'admin' | 'user';
  /** Callback invocado al pulsar sobre el icono de edición del nombre */
  onEditarNombre: () => void;
  /** Callback invocado al pulsar el botón de acceso al panel de administración */
  onIrAdmin: () => void;
}

/**
 * Tarjeta de información del usuario activo en la pantalla de Ajustes.
 * Muestra el nombre registrado, una etiqueta con su rol de privilegios (Administrador vs Usuario Estándar)
 * y, si cuenta con permisos de administrador, un acceso directo destacado a la gestión de usuarios del ESP32.
 * Estilizado íntegramente con clases utilitarias de Tailwind CSS.
 */
export const UsuarioCard: React.FC<UsuarioCardProps> = ({
  userName,
  userRole,
  onEditarNombre,
  onIrAdmin,
}) => {
  const esAdmin = userRole === 'admin';

  return (
    <View style={tw`bg-beige-card rounded-3xl p-5 shadow-sm border border-stone-200/60 mb-6`}>
      <View style={tw`flex-row items-center justify-between`}>
        <View style={tw`flex-row items-center flex-1 mr-3`}>
          <View style={tw`w-12 h-12 rounded-2xl bg-azul-claro items-center justify-center mr-3.5`}>
            <MaterialIcons name="person" size={26} color="#2C5F8A" />
          </View>
          <View style={tw`flex-1`}>
            <Text style={tw`text-xs font-bold text-texto-secundario uppercase tracking-wider`}>
              Usuario Registrado
            </Text>
            <Text style={tw`text-lg font-bold text-azul-oscuro mt-0.5`} numberOfLines={1}>
              {userName || 'Usuario'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={tw`w-9 h-9 rounded-xl bg-stone-100 items-center justify-center`}
          onPress={onEditarNombre}
          activeOpacity={0.7}
        >
          <MaterialIcons name="edit" size={18} color="#2C5F8A" />
        </TouchableOpacity>
      </View>

      <View style={tw`flex-row items-center mt-4 pt-4 border-t border-stone-100`}>
        <View
          style={tw`px-3 py-1 rounded-full ${
            esAdmin ? 'bg-azul-claro border border-blue-200' : 'bg-stone-100'
          }`}
        >
          <Text
            style={tw`text-xs font-bold ${
              esAdmin ? 'text-azul-primario' : 'text-texto-secundario'
            }`}
          >
            {esAdmin ? 'Perfil Administrador' : 'Usuario Estándar'}
          </Text>
        </View>
      </View>

      {esAdmin && (
        <TouchableOpacity
          style={tw`flex-row items-center justify-between mt-4 p-3.5 bg-blue-50/60 rounded-2xl border border-blue-100`}
          onPress={onIrAdmin}
          activeOpacity={0.8}
        >
          <View style={tw`flex-row items-center flex-1 mr-2`}>
            <MaterialIcons name="admin-panel-settings" size={22} color="#2C5F8A" />
            <View style={tw`ml-3 flex-1`}>
              <Text style={tw`text-sm font-bold text-azul-oscuro`}>Gestionar Usuarios ESP32</Text>
              <Text style={tw`text-xs text-texto-secundario mt-0.5`}>
                Desbloqueo y asignación de permisos
              </Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={22} color="#2C5F8A" />
        </TouchableOpacity>
      )}
    </View>
  );
};

export default UsuarioCard;
