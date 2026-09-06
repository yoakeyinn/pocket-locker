import React from 'react';
import { View, TouchableOpacity, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BluetoothStatus } from '../../context/BluetoothContext';
import StatusBadge from './StatusBadge';
import tw from '../../styles/tailwind';

/**
 * Propiedades del componente ControlHeader.
 */
interface ControlHeaderProps {
  /** Callback invocado al pulsar el botón de retroceso hacia la pantalla principal */
  onVolver: () => void;
  /** Estado actual de la conexión Bluetooth con el locker */
  status: BluetoothStatus;
  /** Nombre del dispositivo Bluetooth conectado o nulo */
  deviceName: string | null;
  /** Valor animado nativo para controlar la pulsación o parpadeo del badge durante la conexión */
  blinkValue: Animated.Value;
}

/**
 * Cabecera superior modular para el Panel de Control.
 * Proporciona el botón de retroceso a la pestaña principal y el indicador dinámico de estado
 * de la conexión Bluetooth (`StatusBadge`) perfectamente alineados.
 * Estilizado íntegramente con clases utilitarias de Tailwind CSS.
 */
export const ControlHeader: React.FC<ControlHeaderProps> = ({
  onVolver,
  status,
  deviceName,
  blinkValue,
}) => {
  return (
    <View style={tw`flex-row items-center justify-between px-5 py-3.5 bg-beige-bg`}>
      <TouchableOpacity
        onPress={onVolver}
        style={tw`w-10 h-10 items-center justify-center rounded-xl bg-white shadow-sm border border-stone-200`}
        activeOpacity={0.7}
      >
        <MaterialIcons name="arrow-back" size={22} color="#1A3A5C" />
      </TouchableOpacity>

      <StatusBadge status={status} deviceName={deviceName} blinkValue={blinkValue} />

      <View style={tw`w-10`} />
    </View>
  );
};

export default ControlHeader;
