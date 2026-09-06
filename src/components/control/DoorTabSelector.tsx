import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import tw from '../../styles/tailwind';

/**
 * Propiedades del selector de pestañas DoorTabSelector.
 */
interface DoorTabSelectorProps {
  /** Pestaña actualmente seleccionada ('peatonal' o 'garaje') */
  pestanaActiva: 'peatonal' | 'garaje';
  /** Callback invocado al seleccionar una pestaña distinta */
  onSelect: (pestana: 'peatonal' | 'garaje') => void;
  /** Solo se muestra si el usuario tiene autorización para ambos accesos */
  tieneAmbas: boolean;
}

/**
 * Selector de acceso tipo pestaña entre Puerta Peatonal y Portón de Garaje.
 * Diseñado con clases Tailwind CSS, feedback visual instantáneo y soporte para testID.
 */
export const DoorTabSelector: React.FC<DoorTabSelectorProps> = ({
  pestanaActiva,
  onSelect,
  tieneAmbas,
}) => {
  if (!tieneAmbas) return null;

  return (
    <View style={tw`flex-row bg-stone-200/70 p-1.5 rounded-2xl mb-6`}>
      <TouchableOpacity
        testID="tab-peatonal"
        style={tw`flex-1 flex-row items-center justify-center py-3 rounded-xl ${
          pestanaActiva === 'peatonal' ? 'bg-azul-primario shadow-sm' : 'bg-transparent'
        }`}
        onPress={() => onSelect('peatonal')}
        activeOpacity={0.8}
      >
        <MaterialIcons
          name="door-front"
          size={18}
          color={pestanaActiva === 'peatonal' ? '#FFFFFF' : '#1A3A5C'}
        />
        <Text
          style={tw`text-sm ml-2 ${
            pestanaActiva === 'peatonal' ? 'text-white font-bold' : 'text-azul-oscuro font-semibold'
          }`}
        >
          Puerta Peatonal
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="tab-garaje"
        style={tw`flex-1 flex-row items-center justify-center py-3 rounded-xl ${
          pestanaActiva === 'garaje' ? 'bg-azul-primario shadow-sm' : 'bg-transparent'
        }`}
        onPress={() => onSelect('garaje')}
        activeOpacity={0.8}
      >
        <MaterialIcons
          name="garage"
          size={18}
          color={pestanaActiva === 'garaje' ? '#FFFFFF' : '#1A3A5C'}
        />
        <Text
          style={tw`text-sm ml-2 ${
            pestanaActiva === 'garaje' ? 'text-white font-bold' : 'text-azul-oscuro font-semibold'
          }`}
        >
          Portón de Garaje
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default DoorTabSelector;
