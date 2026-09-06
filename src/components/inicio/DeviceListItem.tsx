import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { DispositivoBT } from '../../services/BluetoothService';
import tw from '../../styles/tailwind';

/**
 * Propiedades del componente DeviceListItem.
 */
interface DeviceListItemProps {
  /** Objeto que describe el dispositivo Bluetooth detectado (nombre, MAC, etc.) */
  item: DispositivoBT;
  /** Callback invocado al seleccionar este dispositivo para iniciar su vinculación */
  onPress: () => void;
}

/**
 * Elemento de fila individual en la lista de dispositivos Bluetooth detectados.
 * Muestra el icono de Bluetooth, el nombre del periférico y su dirección física MAC.
 * Proporciona respuesta táctil y estilo Tailwind CSS acorde al diseño general.
 */
export const DeviceListItem: React.FC<DeviceListItemProps> = ({ item, onPress }) => {
  return (
    <TouchableOpacity
      style={tw`flex-row items-center bg-beige-card p-4 rounded-2xl mb-3 border border-stone-200/60 shadow-sm`}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={tw`w-12 h-12 rounded-xl bg-azul-claro items-center justify-center mr-3.5`}>
        <MaterialIcons name="bluetooth" size={24} color="#2C5F8A" />
      </View>
      <View style={tw`flex-1`}>
        <Text style={tw`text-base font-bold text-azul-oscuro`} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={tw`text-xs text-texto-secundario font-mono mt-0.5`}>{item.address}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={24} color="#6B6B6B" />
    </TouchableOpacity>
  );
};

export default DeviceListItem;
