import React from 'react';
import { View, Animated } from 'react-native';
import { BluetoothStatus } from '../../services/BluetoothService';
import { Text } from '../../styles/tipografia/Tipografia';
import tw, { Colors, tipografia } from '../../styles/styles';

const ESTADOS: Record<BluetoothStatus, { color: () => string; texto: string }> = {
  connected: { color: () => Colors.black, texto: 'Conectado' },
  connecting: { color: () => Colors.gray, texto: 'Conectando...' },
  disconnected: { color: () => Colors.gray, texto: 'Listo' },
  unpaired: { color: () => Colors.gray, texto: 'Sin vincular' },
  unauthorized: { color: () => Colors.red, texto: 'Sin permisos' },
  disabled: { color: () => Colors.red, texto: 'Bluetooth apagado' },
};

export interface StatusBadgeProps {
  status: BluetoothStatus;
  deviceName: string | null;
  blinkValue: Animated.Value;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, deviceName, blinkValue }) => {
  const estado = ESTADOS[status];
  return (
    <View style={tw`items-center`}>
      {deviceName ? (
        <Text style={[tipografia.titulo, tw`text-xl text-center`]} numberOfLines={1} adjustsFontSizeToFit>
          {deviceName}
        </Text>
      ) : null}
      <Animated.View style={[tw`flex-row items-center`, deviceName ? tw`mt-0.5` : null, { opacity: status === 'connecting' ? blinkValue : 1 }]}>
        <View style={[tw`w-1.5 h-1.5 rounded-full mr-2`, { backgroundColor: estado.color() }]} />
        <Text style={[tipografia.anotacion, tw`text-xs`]} numberOfLines={1}>
          {estado.texto}
        </Text>
      </Animated.View>
    </View>
  );
};
