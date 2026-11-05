import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Aparece, ENTRADA_LENTA_MS } from '../Aparece';
import { Boton } from '../Boton';
import { Text } from '../../styles/tipografia/Tipografia';
import { t } from '../../styles/i18n';
import tw, { Colors, tipografia } from '../../styles/styles';

export interface BluetoothPermissionBlockedViewProps {
  onConcederPermisos: () => Promise<void>;
  onAbrirAjustes: () => void;
}

export const BluetoothPermissionBlockedView: React.FC<BluetoothPermissionBlockedViewProps> = ({
  onConcederPermisos,
  onAbrirAjustes,
}) => (
  <SafeAreaView style={tw`flex-1 bg-beige`} edges={['top', 'bottom']}>
    <View style={tw`flex-1 items-center justify-center p-6`}>
      <Aparece duracion={ENTRADA_LENTA_MS} style={tw`items-center`}>
        <View style={tw`w-20 h-20 rounded-full border border-silver bg-white items-center justify-center mb-6`}>
          <MaterialIcons name="security" size={36} color={Colors.black} />
        </View>
        <Text style={[tipografia.titulo, tw`text-3xl text-center mb-3`]}>{t('pl_permisos_titulo')}</Text>
        <Text style={[tipografia.anotacion, tw`text-center mb-8 px-2`, { lineHeight: 22 }]}>
          {t('pl_permisos_mensaje', { app: t('pl_app_titulo') })}
        </Text>
        <Boton
          relleno
          testID="btn-conceder-permisos"
          texto={t('pl_conceder_permisos')}
          onPress={onConcederPermisos}
          style={tw`w-64 mb-3`}
        />
        <Boton
          testID="btn-abrir-ajustes-permisos"
          texto={t('pl_abrir_ajustes_telefono')}
          onPress={onAbrirAjustes}
          style={tw`w-64`}
        />
      </Aparece>
    </View>
  </SafeAreaView>
);
