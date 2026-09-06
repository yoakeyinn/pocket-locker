import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import tw from '../../styles/tailwind';

/**
 * Propiedades del componente PreferenciasCard.
 */
interface PreferenciasCardProps {
  /** Indica si se está ejecutando la sincronización de reloj y permisos con el ESP32 */
  sincronizando: boolean;
  /** Callback invocado al solicitar la sincronización con el hardware */
  onSincronizar: () => void;
  /** Callback invocado al navegar a la pantalla de diagnóstico y logs */
  onIrLogs: () => void;
}

/**
 * Tarjeta de preferencias de usuario y herramientas en la pantalla de Ajustes.
 * Permite desencadenar la sincronización forzada de hora y permisos con el ESP32,
 * y acceder a la consola de diagnóstico y telemetría.
 * Estilizado íntegramente con clases utilitarias de Tailwind CSS.
 */
export const PreferenciasCard: React.FC<PreferenciasCardProps> = ({
  sincronizando,
  onSincronizar,
  onIrLogs,
}) => {
  return (
    <View style={tw`bg-beige-card rounded-3xl p-5 shadow-sm border border-stone-200/60 mb-6`}>

      {/* Sincronización */}
      <TouchableOpacity
        style={tw`flex-row items-center justify-between py-2`}
        onPress={onSincronizar}
        disabled={sincronizando}
        activeOpacity={0.7}
      >
        <View style={tw`flex-1 mr-2`}>
          <Text style={tw`text-sm font-bold text-azul-oscuro`}>Sincronizar con Locker</Text>
          <Text style={tw`text-xs text-texto-secundario mt-0.5`}>
            Actualizar permisos y reloj interno del ESP32
          </Text>
        </View>
        {sincronizando ? (
          <ActivityIndicator size="small" color="#2C5F8A" />
        ) : (
          <MaterialIcons name="sync" size={22} color="#2C5F8A" />
        )}
      </TouchableOpacity>

      <View style={tw`h-px bg-stone-100 my-2`} />

      {/* Diagnóstico / Logs */}
      <TouchableOpacity
        style={tw`flex-row items-center justify-between py-2`}
        onPress={onIrLogs}
        activeOpacity={0.7}
      >
        <View style={tw`flex-1 mr-2`}>
          <Text style={tw`text-sm font-bold text-azul-oscuro`}>Diagnóstico y Telemetría</Text>
          <Text style={tw`text-xs text-texto-secundario mt-0.5`}>
            Ver registro de conexiones, eventos y depuración
          </Text>
        </View>
        <MaterialIcons name="bug-report" size={22} color="#2C5F8A" />
      </TouchableOpacity>
    </View>
  );
};

export default PreferenciasCard;
