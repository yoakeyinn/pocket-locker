import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BluetoothStatus } from '../../context/BluetoothContext';
import tw from '../../styles/tailwind';

/**
 * Propiedades del componente ActiveLockerCard.
 */
interface ActiveLockerCardProps {
  /** Nombre asignado o personalizado del Pocket Locker */
  deviceName: string | null;
  /** Dirección MAC física del ESP32 */
  deviceMac: string | null;
  /** Estado actual de la conexión Bluetooth */
  status: BluetoothStatus;
  /** Acción a ejecutar al pulsar sobre la tarjeta (navegar al panel de control) */
  onPress: () => void;
}

/**
 * Tarjeta de presentación del Locker Activo en la pantalla principal (Tab Inicio).
 * Muestra el nombre del dispositivo, la dirección MAC, una insignia con el estado de conectividad
 * y un botón interactivo que invita al usuario a entrar al panel de control de relés.
 * Estilizado íntegramente con clases utilitarias de Tailwind CSS.
 */
export const ActiveLockerCard: React.FC<ActiveLockerCardProps> = ({
  deviceName,
  deviceMac,
  status,
  onPress,
}) => {
  let statusLabel = 'Desconectado';
  let statusColor = '#6B6B6B';

  if (status === 'connected') {
    statusLabel = 'Conectado';
    statusColor = '#49A241';
  } else if (status === 'connecting') {
    statusLabel = 'Conectando...';
    statusColor = '#FF9800';
  }

  return (
    <TouchableOpacity
      style={tw`bg-beige-card rounded-3xl p-6 shadow-md border border-stone-200/60 w-full`}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={tw`flex-row items-center justify-between mb-4`}>
        <View style={tw`flex-row items-center bg-stone-100 px-3 py-1 rounded-full`}>
          <View style={[tw`w-2 h-2 rounded-full mr-2`, { backgroundColor: statusColor }]} />
          <Text style={[tw`text-xs font-bold`, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      <View style={tw`flex-row items-center my-4`}>
        <View style={tw`w-16 h-16 rounded-2xl bg-azul-claro items-center justify-center mr-4`}>
          <MaterialIcons name="lock" size={36} color="#2C5F8A" />
        </View>
        <View style={tw`flex-1`}>
          <Text style={tw`text-xl font-extrabold text-azul-oscuro`} numberOfLines={1}>
            {deviceName || 'Pocket Locker'}
          </Text>
          <Text style={tw`text-xs text-texto-secundario mt-1 font-mono tracking-wider`}>
            {deviceMac}
          </Text>
        </View>
      </View>

      <View style={tw`flex-row items-center justify-between pt-4 border-t border-stone-100 mt-2`}>
        <Text style={tw`text-sm font-bold text-azul-primario`}>Entrar a los controles</Text>
        <View style={tw`w-8 h-8 rounded-full bg-azul-claro items-center justify-center`}>
          <MaterialIcons name="arrow-forward" size={16} color="#2C5F8A" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default ActiveLockerCard;
