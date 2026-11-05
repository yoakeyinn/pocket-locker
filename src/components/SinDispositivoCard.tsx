import React from 'react';
import { View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Aparece } from './Aparece';
import { Boton } from './Boton';
import { t } from '../styles/i18n';
import { Text } from '../styles/tipografia/Tipografia';
import tw, { Colors, tipografia } from '../styles/styles';

export const SinDispositivoCard: React.FC<{ onBuscar: () => void }> = ({ onBuscar }) => {
  const app = t('pl_app_titulo');
  return (
    <Aparece style={tw`w-full`}>
      <View style={tw`items-center justify-center p-6 bg-white rounded-lg border border-silver`}>
        <View style={tw`w-16 h-16 rounded-full border border-silver bg-beige items-center justify-center mb-4`}>
          <MaterialIcons name="bluetooth-searching" size={30} color={Colors.black} />
        </View>
        <Text style={[tipografia.titulo, tw`text-xl text-center`]}>{t('pl_sin_dispositivo_titulo')}</Text>
        <Text style={[tipografia.anotacion, tw`text-xs text-center mt-3 mb-6 px-2`, { lineHeight: 20 }]}>
          {t('pl_sin_dispositivo_mensaje', { app })}
        </Text>
        <Boton relleno testID="btn-buscar-locker" icono="search" texto={t('pl_buscar_app', { app })} onPress={onBuscar} />
      </View>
    </Aparece>
  );
};
