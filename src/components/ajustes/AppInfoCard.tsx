import { t } from '../../styles/i18n';
import React from 'react';
import { View } from 'react-native';
import { Text } from '../../styles/tipografia/Tipografia';
import tw, { APP_VERSION, tipografia } from '../../styles/styles';
import { useSimulacion } from '../../services/Simulacion';

export const AppInfoCard: React.FC = () => {
  const simulando = useSimulacion((estado) => estado.activa);
  return (
    <View style={tw`items-center justify-center py-6 mb-8`}>
      <Text style={tw`text-xs font-bold text-black tracking-wider`}>{`${t('pl_app_titulo')} v${APP_VERSION}`}</Text>
      <Text style={tw`text-xs text-gray mt-1`}>{t('pl_tagline')}</Text>
      {simulando ? (
        <Text testID="aviso-demo" style={[tipografia.anotacion, tw`text-xs text-center mt-3 px-4`]}>
          {t('pl_modo_demo')}
        </Text>
      ) : null}
    </View>
  );
};
