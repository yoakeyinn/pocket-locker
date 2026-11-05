import React from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Aparece, ENTRADA_LENTA_MS } from '../Aparece';
import { Boton } from '../Boton';
import { Text } from '../../styles/tipografia/Tipografia';
import { t } from '../../styles/i18n';
import tw, { Colors, tipografia } from '../../styles/styles';

export interface AvisoBluetoothApagadoProps {
  onActivar: () => void;
  onAbrirAjustes: () => void;
}

export const AvisoBluetoothApagado: React.FC<AvisoBluetoothApagadoProps> = ({ onActivar, onAbrirAjustes }) => (
  <Aparece duracion={ENTRADA_LENTA_MS} style={tw`mb-5`}>
    <View testID="aviso-bluetooth-apagado" style={tw`bg-white border border-silver rounded-lg p-5 items-center`}>
      <Feather name="alert-circle" size={22} color={Colors.black} />
      <Text style={[tipografia.titulo, tw`text-lg text-center mt-3`]}>{t('pl_bt_apagado_titulo')}</Text>
      <Text style={[tipografia.anotacion, tw`text-xs text-center mt-2`, { lineHeight: 20 }]}>
        {t('pl_bt_apagado_mensaje', { app: t('pl_app_titulo') })}
      </Text>
      <View style={tw`w-full mt-5`}>
        <Boton relleno testID="btn-activar-bluetooth" texto={t('pl_activar_bluetooth')} onPress={onActivar} />
        <Boton
          testID="btn-abrir-ajustes-bluetooth"
          texto={t('pl_abrir_ajustes_telefono')}
          onPress={onAbrirAjustes}
          style={tw`mt-2.5`}
        />
      </View>
    </View>
  </Aparece>
);
