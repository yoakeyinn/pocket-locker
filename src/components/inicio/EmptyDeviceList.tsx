import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import tw from '../../styles/tailwind';

/**
 * Propiedades del componente EmptyDeviceList.
 */
interface EmptyDeviceListProps {
  /** Callback para abrir los ajustes nativos de Bluetooth del sistema operativo */
  onAbrirAjustes: () => void;
}

/**
 * Vista de estado vacío que se muestra cuando no se detectan dispositivos vinculados o accesibles.
 * Proporciona instrucciones claras al usuario sobre cómo encender y acercar el Pocket Locker,
 * e incluye un botón directo para acceder a los ajustes Bluetooth del sistema operativo.
 * Estilizado íntegramente con clases utilitarias de Tailwind CSS.
 */
export const EmptyDeviceList: React.FC<EmptyDeviceListProps> = ({ onAbrirAjustes }) => {
  return (
    <View style={tw`items-center justify-center p-6 my-6 bg-beige-card rounded-3xl border border-dashed border-stone-300`}>
      <View style={tw`w-16 h-16 rounded-full bg-azul-claro items-center justify-center mb-4`}>
        <MaterialIcons name="bluetooth-searching" size={32} color="#2C5F8A" />
      </View>
      <Text style={tw`text-base font-bold text-azul-oscuro text-center`}>
        ¿No aparece tu Pocket Locker?
      </Text>
      <Text style={tw`text-xs text-texto-secundario text-center mt-2 mb-6 leading-5 px-4`}>
        Asegúrate de que tu Pocket Locker esté encendido y cerca de ti. Si lo deseas, puedes abrir los Ajustes de Bluetooth del teléfono.
      </Text>
      <TouchableOpacity
        testID="btn-abrir-ajustes"
        style={tw`flex-row items-center bg-azul-primario px-5 py-3.5 rounded-xl shadow-sm`}
        onPress={onAbrirAjustes}
        activeOpacity={0.85}
      >
        <MaterialIcons name="settings" size={18} color="#FFFFFF" />
        <Text style={tw`text-white font-bold text-sm ml-2`}>Abrir Ajustes Bluetooth</Text>
      </TouchableOpacity>
    </View>
  );
};

export default EmptyDeviceList;
