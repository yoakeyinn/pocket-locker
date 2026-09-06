import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import tw from '../../styles/tailwind';

/**
 * Propiedades del componente AccessInfoBanner.
 */
interface AccessInfoBannerProps {
  /** Indica si el usuario actual tiene el acceso revocado o vencido por el administrador */
  estaBloqueado: boolean;
  /** Número de días restantes de validez del acceso (-1 = ilimitado, null = sin datos de caducidad) */
  diasRestantes: number | null;
}

/**
 * Banner informativo de restricciones de acceso en el Panel de Control.
 * Muestra alertas visuales destacadas si el usuario se encuentra bloqueado,
 * o si tiene un permiso de acceso temporal con fecha de caducidad próxima.
 * Estilizado íntegramente con clases utilitarias de Tailwind CSS.
 */
export const AccessInfoBanner: React.FC<AccessInfoBannerProps> = ({
  estaBloqueado,
  diasRestantes,
}) => {
  if (estaBloqueado) {
    return (
      <View style={tw`flex-row items-center bg-red-50 border border-red-200 px-4 py-3 rounded-xl mb-4`}>
        <MaterialIcons name="lock" size={20} color="#E85D5D" />
        <Text style={tw`text-xs font-semibold text-error-rojo ml-2.5 flex-1 leading-4`}>
          Acceso bloqueado o expirado. Contacta con el administrador.
        </Text>
      </View>
    );
  }

  if (diasRestantes !== null) {
    return (
      <View style={tw`flex-row items-center bg-blue-50 border border-blue-200 px-4 py-2.5 rounded-xl mb-4`}>
        <MaterialIcons name="schedule" size={16} color="#2C5F8A" />
        <Text style={tw`text-xs font-semibold text-azul-primario ml-2 flex-1`}>
          {diasRestantes === 0
            ? 'Acceso temporal: vence hoy'
            : `Acceso temporal: ${diasRestantes} día(s) restante(s)`}
        </Text>
      </View>
    );
  }

  return null;
};

export default AccessInfoBanner;
