import React from 'react';
import { View, Text, TouchableOpacity, Animated, ActivityIndicator } from 'react-native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { BluetoothStatus } from '../services/BluetoothService';
import tw from '../styles';

// =============================================================================
// 1. STATUS BADGE & CONTROL HEADER
// =============================================================================

const STATUS_CONFIG: Record<BluetoothStatus, { color: string; defaultText: string }> = {
  connected: { color: '#49A241', defaultText: 'Conectado' },
  connecting: { color: '#FF9800', defaultText: 'Conectando...' },
  disconnected: { color: '#2C5F8A', defaultText: 'Listo' },
  unpaired: { color: '#6B6B6B', defaultText: 'Sin vincular' },
  unauthorized: { color: '#E85D5D', defaultText: 'Sin permisos' },
  disabled: { color: '#E85D5D', defaultText: 'Bluetooth apagado' },
};

export interface StatusBadgeProps {
  status: BluetoothStatus;
  deviceName: string | null;
  blinkValue: Animated.Value;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, deviceName, blinkValue }) => {
  const config = STATUS_CONFIG[status] || { color: '#6B6B6B', defaultText: 'Desconectado' };
  const statusText = (status === 'connected' || status === 'disconnected') && deviceName
    ? deviceName
    : config.defaultText;

  return (
    <Animated.View
      style={[
        tw`flex-row items-center bg-azul-claro px-3.5 py-1.5 rounded-full border border-blue-100`,
        { opacity: status === 'connecting' ? blinkValue : 1 },
      ]}
    >
      <View style={[tw`w-2 h-2 rounded-full mr-2`, { backgroundColor: config.color }]} />
      <Text style={tw`text-xs font-bold text-azul-oscuro tracking-wide`} numberOfLines={1}>
        {statusText}
      </Text>
    </Animated.View>
  );
};

export interface ControlHeaderProps {
  onVolver: () => void;
  status: BluetoothStatus;
  deviceName: string | null;
  blinkValue: Animated.Value;
  onPressAjustes?: () => void;
}

export const ControlHeader: React.FC<ControlHeaderProps> = ({
  onVolver,
  status,
  deviceName,
  blinkValue,
  onPressAjustes,
}) => (
  <View style={tw`flex-row items-center justify-between px-5 py-3.5 bg-beige-bg`}>
    <TouchableOpacity
      onPress={onVolver}
      style={tw`w-10 h-10 items-center justify-center rounded-xl bg-white shadow-sm border border-stone-200`}
      activeOpacity={0.7}
    >
      <MaterialIcons name="arrow-back" size={22} color="#1A3A5C" />
    </TouchableOpacity>

    <StatusBadge status={status} deviceName={deviceName} blinkValue={blinkValue} />

    <TouchableOpacity
      testID="btn-header-ajustes"
      onPress={onPressAjustes}
      style={tw`w-10 h-10 items-center justify-center rounded-xl bg-white shadow-sm border border-stone-200`}
      activeOpacity={0.7}
    >
      <MaterialIcons name="settings" size={22} color="#1A3A5C" />
    </TouchableOpacity>
  </View>
);

// =============================================================================
// 2. SELECTOR SEGMENTADO DE ACCESOS
// =============================================================================

export interface AccessSegmentedControlProps {
  pestanaActiva: 'peatonal' | 'garaje';
  onSelect: (puerta: 'peatonal' | 'garaje') => void;
  tieneAmbas?: boolean;
}

export const AccessSegmentedControl: React.FC<AccessSegmentedControlProps> = ({
  pestanaActiva,
  onSelect,
  tieneAmbas = true,
}) => {
  if (!tieneAmbas) {
    return (
      <View style={tw`flex-row items-center justify-center px-4 py-1.5 bg-stone-200/60 rounded-full mb-2`}>
        <Text style={tw`text-xs font-bold text-azul-oscuro`}>
          {pestanaActiva === 'garaje' ? 'Portón de Garaje' : 'Puerta Peatonal'}
        </Text>
      </View>
    );
  }

  return (
    <View style={tw`flex-row items-center justify-center p-1 bg-stone-200/60 rounded-full mb-2`}>
      <TouchableOpacity
        testID="tab-peatonal"
        onPress={() => onSelect('peatonal')}
        style={tw`px-5 py-2 rounded-full ${pestanaActiva === 'peatonal' ? 'bg-emerald-600 shadow-sm' : 'bg-transparent'}`}
        activeOpacity={0.8}
      >
        <Text style={tw`text-xs font-bold ${pestanaActiva === 'peatonal' ? 'text-white' : 'text-stone-600'}`}>
          Puerta Peatonal
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="tab-garaje"
        onPress={() => onSelect('garaje')}
        style={tw`px-5 py-2 rounded-full ${pestanaActiva === 'garaje' ? 'bg-azul-primario shadow-sm' : 'bg-transparent'}`}
        activeOpacity={0.8}
      >
        <Text style={tw`text-xs font-bold ${pestanaActiva === 'garaje' ? 'text-white' : 'text-stone-600'}`}>
          Portón de Garaje
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// =============================================================================
// 3. PULSADOR CIRCULAR Y ONDAS CONCÉNTRICAS (DOOR ACTION BUTTON)
// =============================================================================

export interface DoorActionButtonProps {
  tipo: 'peatonal' | 'garaje';
  ejecutando: 'peatonal' | 'garaje' | null;
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

  const waveClass = (capa: 1 | 2) => {
    if (esPeatonal) {
      return esActivo
        ? capa === 1 ? 'bg-emerald-400/25 border border-emerald-300/40' : 'bg-emerald-400/30 border border-emerald-300/50'
        : capa === 1 ? 'bg-emerald-500/15 border border-emerald-400/30' : 'bg-emerald-500/20 border border-emerald-400/35';
    }
    return esActivo
      ? capa === 1 ? 'bg-blue-400/25 border border-blue-300/40' : 'bg-blue-400/30 border border-blue-300/50'
      : capa === 1 ? 'bg-azul-primario/15 border border-azul-primario/25' : 'bg-azul-primario/20 border border-azul-primario/35';
  };

  const btnStyle = enCooldown
    ? 'bg-stone-300 border-stone-200 shadow-none'
    : esPeatonal
    ? esActivo ? 'bg-emerald-500 border-emerald-200' : 'bg-emerald-600 border-emerald-400/80'
    : esActivo ? 'bg-blue-600 border-blue-300' : 'bg-azul-primario border-blue-400/80';

  return (
    <View style={tw`items-center justify-center w-full py-2`}>
      <View style={tw`w-72 h-72 items-center justify-center relative`}>
        <Animated.View
          pointerEvents="none"
          style={[
            tw`w-52 h-52 rounded-full absolute ${waveClass(1)}`,
            { transform: [{ scale: radarPulse1 }], opacity: radarOpacity1 },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            tw`w-52 h-52 rounded-full absolute ${waveClass(2)}`,
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
              <ActivityIndicator size="large" color="#FFFFFF" />
            ) : esPeatonal ? (
              <FontAwesome5 name="walking" size={62} color="#FFFFFF" style={tw`ml-1`} />
            ) : (
              <FontAwesome5 name="car-side" size={56} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      <View style={tw`h-8 items-center justify-center mt-1`}>
        <Text
          style={tw`text-sm font-semibold tracking-wide ${
            enCooldown
              ? 'text-stone-500'
              : esPeatonal
              ? esActivo ? 'text-emerald-700' : 'text-stone-600'
              : esActivo ? 'text-azul-primario' : 'text-stone-600'
          }`}
        >
          {estadoTexto}
        </Text>
      </View>
    </View>
  );
};
