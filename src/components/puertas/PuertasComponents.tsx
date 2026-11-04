import React from 'react';
import { View, TouchableOpacity, Animated } from 'react-native';
import { Cargando } from '../Cargando';
import { FontAwesome5 } from '@expo/vector-icons';
import { BluetoothStatus } from '../../services/BluetoothService';
import { BotonIcono } from '../BotonIcono';
import { Text } from '../../styles/tipografia/Tipografia';
import tw, { Colors } from '../../styles/styles';
import { Puerta } from '../../services/comun';

const STATUS_CONFIG: Record<BluetoothStatus, { color: string; defaultText: string }> = {
  connected: { color: Colors.black, defaultText: 'Conectado' },
  connecting: { color: Colors.gray, defaultText: 'Conectando...' },
  disconnected: { color: Colors.gray, defaultText: 'Listo' },
  unpaired: { color: Colors.gray, defaultText: 'Sin vincular' },
  unauthorized: { color: Colors.red, defaultText: 'Sin permisos' },
  disabled: { color: Colors.red, defaultText: 'Bluetooth apagado' },
};

export interface StatusBadgeProps {
  status: BluetoothStatus;
  deviceName: string | null;
  blinkValue: Animated.Value;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, deviceName, blinkValue }) => {
  const config = STATUS_CONFIG[status] || { color: Colors.gray, defaultText: 'Desconectado' };
  const statusText = (status === 'connected' || status === 'disconnected') && deviceName
    ? deviceName
    : config.defaultText;

  return (
    <Animated.View
      style={[
        tw`flex-row items-center bg-silver px-3.5 py-1.5 rounded-full border border-silver`,
        { opacity: status === 'connecting' ? blinkValue : 1 },
      ]}
    >
      <View style={[tw`w-2 h-2 rounded-full mr-2`, { backgroundColor: config.color }]} />
      <Text style={tw`text-xs font-bold text-black tracking-wide`} numberOfLines={1}>
        {statusText}
      </Text>
    </Animated.View>
  );
};

export interface PuertasHeaderProps {
  userName: string;
  status: BluetoothStatus;
  deviceName: string | null;
  blinkValue: Animated.Value;
  onPressAjustes?: () => void;
}

export const PuertasHeader: React.FC<PuertasHeaderProps> = ({
  userName,
  status,
  deviceName,
  blinkValue,
  onPressAjustes,
}) => (
  <View style={tw`flex-row items-center px-5 py-3.5 bg-beige`}>
    <Text style={tw`flex-1 mr-3 font-display text-lg font-bold text-black`} numberOfLines={1}>
      {`Hola, ${userName}`}
    </Text>

    <StatusBadge status={status} deviceName={deviceName} blinkValue={blinkValue} />

    <View style={tw`ml-2`}>
      <BotonIcono testID="btn-header-ajustes" icono="settings" onPress={onPressAjustes} />
    </View>
  </View>
);

export interface AccessSegmentedControlProps {
  pestanaActiva: Puerta;
  onSelect: (puerta: Puerta) => void;
}

export const AccessSegmentedControl: React.FC<AccessSegmentedControlProps> = ({
  pestanaActiva,
  onSelect,
}) => (
  <View style={tw`flex-row items-center justify-center p-1 bg-silver/60 rounded-full mb-2`}>
    <TouchableOpacity
      testID="tab-peatonal"
      onPress={() => onSelect('peatonal')}
      style={tw`px-5 py-2 rounded-full ${pestanaActiva === 'peatonal' ? 'bg-black shadow-sm' : 'bg-transparent'}`}
      activeOpacity={0.8}
    >
      <Text style={tw`text-xs font-bold ${pestanaActiva === 'peatonal' ? 'text-white' : 'text-gray'}`}>
        Puerta Peatonal
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      testID="tab-garaje"
      onPress={() => onSelect('garaje')}
      style={tw`px-5 py-2 rounded-full ${pestanaActiva === 'garaje' ? 'bg-gray shadow-sm' : 'bg-transparent'}`}
      activeOpacity={0.8}
    >
      <Text style={tw`text-xs font-bold ${pestanaActiva === 'garaje' ? 'text-white' : 'text-gray'}`}>
        Portón de Garaje
      </Text>
    </TouchableOpacity>
  </View>
);

export interface DoorActionButtonProps {
  tipo: Puerta;
  ejecutando: Puerta | null;
  tiempoRestanteBloqueo: number;
  botonDeshabilitado: boolean;
  onPress: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  buttonPressScale: Animated.Value;
  radarPulse1: Animated.Value;
  radarPulse2: Animated.Value;
  radarOpacity1: Animated.Value;
  radarOpacity2: Animated.Value;
}

export const DoorActionButton: React.FC<DoorActionButtonProps> = ({
  tipo,
  ejecutando,
  tiempoRestanteBloqueo,
  botonDeshabilitado,
  onPress,
  onPressIn,
  onPressOut,
  buttonPressScale,
  radarPulse1,
  radarPulse2,
  radarOpacity1,
  radarOpacity2,
}) => {
  const esPeatonal = tipo === 'peatonal';
  const esActivo = ejecutando === tipo;
  const enCooldown = tiempoRestanteBloqueo > 0;

  const estadoTexto = esActivo
    ? esPeatonal ? 'Abriendo puerta...' : 'Abriendo portón...'
    : enCooldown
    ? `Espera ${tiempoRestanteBloqueo} s...`
    : 'Pulsar para abrir';

  const ondaClase = (capa: 1 | 2) =>
    esActivo
      ? capa === 1 ? 'bg-gray/25 border border-gray/40' : 'bg-gray/30 border border-gray/50'
      : capa === 1 ? 'bg-gray/15 border border-gray/30' : 'bg-gray/20 border border-gray/35';

  const btnStyle = enCooldown
    ? 'bg-silver border-silver shadow-none'
    : esPeatonal
    ? esActivo ? 'bg-gray border-silver' : 'bg-black border-gray/80'
    : esActivo ? 'bg-gray border-gray' : 'bg-gray border-gray/80';

  return (
    <View style={tw`items-center justify-center w-full py-2`}>
      <View style={tw`w-72 h-72 items-center justify-center relative`}>
        <Animated.View
          pointerEvents="none"
          style={[
            tw`w-52 h-52 rounded-full absolute ${ondaClase(1)}`,
            { transform: [{ scale: radarPulse1 }], opacity: radarOpacity1 },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            tw`w-52 h-52 rounded-full absolute ${ondaClase(2)}`,
            { transform: [{ scale: radarPulse2 }], opacity: radarOpacity2 },
          ]}
        />

        <Animated.View
          style={[
            tw`w-44 h-44 rounded-full items-center justify-center shadow-xl`,
            { transform: [{ scale: buttonPressScale }] },
          ]}
        >
          <TouchableOpacity
            testID={esPeatonal ? 'btn-peatonal' : 'btn-garaje'}
            onPress={onPress}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            disabled={botonDeshabilitado}
            activeOpacity={1}
            delayPressIn={0}
            style={tw`w-full h-full rounded-full items-center justify-center border-4 ${btnStyle}`}
          >
            {esActivo ? (
              <Cargando tamano={56} />
            ) : esPeatonal ? (
              <FontAwesome5 name="walking" size={62} color={Colors.white} style={tw`ml-1`} />
            ) : (
              <FontAwesome5 name="car-side" size={56} color={Colors.white} />
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      <View style={tw`h-8 items-center justify-center mt-1`}>
        <Text
          style={tw`text-sm font-semibold tracking-wide text-gray`}
        >
          {estadoTexto}
        </Text>
      </View>
    </View>
  );
};
