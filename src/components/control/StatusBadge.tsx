import React from 'react';
import { Animated, View, Text } from 'react-native';
import { BluetoothStatus } from '../../context/BluetoothContext';
import tw from '../../styles/tailwind';

/**
 * Propiedades del componente StatusBadge.
 */
interface StatusBadgeProps {
  /** Estado actual de la conexión Bluetooth */
  status: BluetoothStatus;
  /** Nombre del dispositivo conectado o nulo */
  deviceName: string | null;
  /** Valor animado para la pulsación u oscilación de opacidad durante el proceso de conexión */
  blinkValue: Animated.Value;
}

/**
 * Insignia visual (Badge) que representa el estado de la conexión Bluetooth en tiempo real.
 * Emplea un código de color estándar (verde = conectado, naranja = conectando, rojo = error/sin permisos, gris = desconectado)
 * y una suave animación de parpadeo nativo a 60 FPS durante la fase de sincronización.
 * Estilizado íntegramente con clases utilitarias de Tailwind CSS.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, deviceName, blinkValue }) => {
  let statusColor = '#6B6B6B';
  let statusText = 'Desconectado';

  switch (status) {
    case 'connected':
      statusColor = '#49A241';
      statusText = deviceName ? deviceName : 'Conectado';
      break;
    case 'connecting':
      statusColor = '#FF9800';
      statusText = 'Conectando...';
      break;
    case 'disconnected':
      statusColor = '#2C5F8A';
      statusText = deviceName ? deviceName : 'Listo';
      break;
    case 'unpaired':
      statusColor = '#6B6B6B';
      statusText = 'Sin vincular';
      break;
    case 'unauthorized':
      statusColor = '#E85D5D';
      statusText = 'Sin permisos';
      break;
    case 'disabled':
      statusColor = '#E85D5D';
      statusText = 'Bluetooth apagado';
      break;
  }

  return (
    <Animated.View
      style={[
        tw`flex-row items-center bg-azul-claro px-3.5 py-1.5 rounded-full border border-blue-100`,
        { opacity: status === 'connecting' ? blinkValue : 1 },
      ]}
    >
      <View style={[tw`w-2 h-2 rounded-full mr-2`, { backgroundColor: statusColor }]} />
      <Text style={tw`text-xs font-bold text-azul-oscuro tracking-wide`} numberOfLines={1}>
        {statusText}
      </Text>
    </Animated.View>
  );
};

export default StatusBadge;
