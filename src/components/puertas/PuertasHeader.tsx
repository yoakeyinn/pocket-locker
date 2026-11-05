import React from 'react';
import { View, Animated } from 'react-native';
import { BluetoothStatus } from '../../services/BluetoothService';
import { Aparece } from '../Aparece';
import { BotonIcono } from '../BotonIcono';
import tw from '../../styles/styles';
import { StatusBadge } from './StatusBadge';

export interface PuertasHeaderProps {
  status: BluetoothStatus;
  deviceName: string | null;
  blinkValue: Animated.Value;
  onPressAjustes: () => void;
}

const ANCHO_BOTON = 40;
const AIRE = 12;

export const PuertasHeader: React.FC<PuertasHeaderProps> = ({ status, deviceName, blinkValue, onPressAjustes }) => (
  <Aparece>
    <View style={tw`px-5 py-3`}>
      <View style={[tw`items-center justify-center`, { minHeight: 40, paddingHorizontal: ANCHO_BOTON + AIRE }]}>
        <StatusBadge status={status} deviceName={deviceName} blinkValue={blinkValue} />
      </View>
      <View style={tw`absolute right-5 top-3 bottom-3 justify-center`}>
        <BotonIcono testID="btn-header-ajustes" icono="settings" onPress={onPressAjustes} />
      </View>
    </View>
  </Aparece>
);
