import React from 'react';
import { View, Text } from 'react-native';
import tw from '../../styles/tailwind';

/**
 * Pie informativo con la versión y edición actual de la aplicación Pocket Locker.
 * Muestra el número de versión semántica y la descripción técnica de la arquitectura.
 * Estilizado íntegramente con clases utilitarias de Tailwind CSS.
 */
export const AppInfoCard: React.FC = () => {
  return (
    <View style={tw`items-center justify-center py-6 mb-8`}>
      <Text style={tw`text-xs font-bold text-azul-primario tracking-wider`}>
        Pocket Locker v1.1.2
      </Text>
      <Text style={tw`text-xs text-texto-secundario mt-1`}>
        ESP32 Multi-User & Secure Storage Edition
      </Text>
    </View>
  );
};

export default AppInfoCard;
