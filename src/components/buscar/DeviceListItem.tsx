import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { Aparece, retrasoEscalonado } from '../Aparece';
import { DispositivoBT, SIN_NOMBRE } from '../../services/BluetoothService';
import { Text } from '../../styles/tipografia/Tipografia';
import { t } from '../../styles/i18n';
import tw, { Colors, tipografia } from '../../styles/styles';

export interface DeviceListItemProps {
  item: DispositivoBT;
  onPress: () => void;
  indice?: number;
}

const MARGEN_FILA = 12;

export const DeviceListItem: React.FC<DeviceListItemProps> = ({ item, onPress, indice = 0 }) => (
  <Aparece retraso={retrasoEscalonado(indice)} style={{ marginBottom: MARGEN_FILA }}>
    <TouchableOpacity
      style={tw`flex-row items-center bg-white px-4 py-3.5 rounded-lg border border-silver`}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {}
      <View style={tw`w-9 h-9 rounded-full bg-silver items-center justify-center mr-4`}>
        <Feather name="bluetooth" size={17} color={Colors.black} />
      </View>
      <View style={tw`flex-1`}>
        <Text style={[tipografia.texto, tw`text-base`]} numberOfLines={1}>
          {item.name === SIN_NOMBRE ? t('pl_sin_nombre') : item.name}
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={22} color={Colors.black} />
    </TouchableOpacity>
  </Aparece>
);
