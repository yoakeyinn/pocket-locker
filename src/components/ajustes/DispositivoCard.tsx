import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import tw from '../../styles/tailwind';

/**
 * Propiedades del componente DispositivoCard.
 */
interface DispositivoCardProps {
  /** Dirección MAC física del ESP32 vinculado, o null si no hay dispositivo vinculado */
  deviceMac: string | null;
  /** Nombre amigable asignado al locker */
  deviceName: string | null;
  /** PIN de seguridad almacenado localmente de forma segura para este dispositivo */
  devicePin: string;
  /** Callback invocado al pulsar el botón de editar nombre */
  onRenombrar: () => void;
  /** Callback invocado al pulsar el botón de editar PIN de seguridad */
  onEditarPin: () => void;
  /** Callback invocado al pulsar el botón de desvincular dispositivo */
  onDesvincular: () => void;
}

/**
 * Tarjeta de gestión del dispositivo vinculado en la pantalla de Ajustes.
 * Permite consultar y modificar el nombre, la dirección MAC y el PIN seguro del Pocket Locker,
 * así como desvincularlo de manera segura borrando las credenciales de `SecureStore`.
 * Si no hay dispositivo vinculado, muestra un estado vacío instructivo.
 * Estilizado íntegramente con clases utilitarias de Tailwind CSS.
 */
export const DispositivoCard: React.FC<DispositivoCardProps> = ({
  deviceMac,
  deviceName,
  devicePin,
  onRenombrar,
  onEditarPin,
  onDesvincular,
}) => {
  if (!deviceMac) {
    return (
      <View style={tw`bg-beige-card rounded-3xl p-6 shadow-sm border border-dashed border-stone-300 items-center justify-center mb-6`}>
        <MaterialIcons name="phonelink-erase" size={36} color="#6B6B6B" />
        <Text style={tw`text-xs text-texto-secundario text-center mt-3 leading-5 px-4`}>
          No hay ningún dispositivo vinculado actualmente. Ve a la pestaña Inicio para buscar y vincular tu Pocket Locker.
        </Text>
      </View>
    );
  }

  return (
    <View style={tw`bg-beige-card rounded-3xl p-5 shadow-sm border border-stone-200/60 mb-6`}>
      {/* Fila Nombre */}
      <View style={tw`flex-row items-center justify-between py-2`}>
        <View style={tw`w-10 h-10 rounded-xl bg-azul-claro items-center justify-center mr-3`}>
          <MaterialIcons name="lock" size={20} color="#2C5F8A" />
        </View>
        <View style={tw`flex-1 mr-2`}>
          <Text style={tw`text-xs font-bold text-texto-secundario uppercase tracking-wider`}>Nombre</Text>
          <Text style={tw`text-base font-bold text-azul-oscuro mt-0.5`} numberOfLines={1}>
            {deviceName}
          </Text>
        </View>
        <TouchableOpacity
          style={tw`w-9 h-9 rounded-xl bg-stone-100 items-center justify-center`}
          onPress={onRenombrar}
          activeOpacity={0.7}
        >
          <MaterialIcons name="edit" size={18} color="#2C5F8A" />
        </TouchableOpacity>
      </View>

      <View style={tw`h-px bg-stone-100 my-2`} />

      {/* Fila MAC */}
      <View style={tw`flex-row items-center py-2`}>
        <View style={tw`w-10 h-10 rounded-xl bg-stone-100 items-center justify-center mr-3`}>
          <MaterialIcons name="fingerprint" size={20} color="#6B6B6B" />
        </View>
        <View style={tw`flex-1`}>
          <Text style={tw`text-xs font-bold text-texto-secundario uppercase tracking-wider`}>Dirección MAC</Text>
          <Text style={tw`text-sm font-mono text-stone-700 mt-0.5`}>{deviceMac}</Text>
        </View>
      </View>

      <View style={tw`h-px bg-stone-100 my-2`} />

      {/* Fila PIN */}
      <View style={tw`flex-row items-center justify-between py-2`}>
        <View style={tw`w-10 h-10 rounded-xl bg-azul-claro items-center justify-center mr-3`}>
          <MaterialIcons name="vpn-key" size={20} color="#2C5F8A" />
        </View>
        <View style={tw`flex-1 mr-2`}>
          <Text style={tw`text-xs font-bold text-texto-secundario uppercase tracking-wider`}>PIN de Seguridad</Text>
          <Text style={tw`text-base font-bold text-azul-oscuro mt-0.5 tracking-widest`}>
            ● ● ● ●
          </Text>
        </View>
        <TouchableOpacity
          style={tw`w-9 h-9 rounded-xl bg-stone-100 items-center justify-center`}
          onPress={onEditarPin}
          activeOpacity={0.7}
        >
          <MaterialIcons name="edit" size={18} color="#2C5F8A" />
        </TouchableOpacity>
      </View>

      <View style={tw`h-px bg-stone-100 my-2`} />

      {/* Botón Desvincular */}
      <TouchableOpacity
        style={tw`flex-row items-center justify-center py-3.5 mt-2 bg-red-50 rounded-2xl border border-red-200/80`}
        onPress={onDesvincular}
        activeOpacity={0.8}
      >
        <MaterialIcons name="delete-outline" size={20} color="#E85D5D" />
        <Text style={tw`text-sm font-bold text-error-rojo ml-2`}>Desvincular Dispositivo</Text>
      </TouchableOpacity>
    </View>
  );
};

export default DispositivoCard;
