import React, { useState, useEffect } from 'react';
import {
  FlatList,
  Text,
  TouchableOpacity,
  View,
  Alert,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import LogService, { LogEntry } from '../services/LogService';
import tw from '../styles/tailwind';

/**
 * Pantalla de Diagnóstico y Visor de Registros (Logs).
 * Permite a desarrolladores y técnicos inspeccionar en tiempo real las operaciones
 * Bluetooth, cambios de estado, tramas enviadas y posibles errores del sistema.
 * Estilizado exclusivamente con Tailwind CSS.
 */
export default function LogsScreen() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [modoTextoCopiar, setModoTextoCopiar] = useState(false);

  useEffect(() => {
    const unsubscribe = LogService.subscribe((currentLogs) => {
      setLogs(currentLogs);
    });
    return () => unsubscribe();
  }, []);

  const handleClear = () => {
    Alert.alert('Limpiar logs', '¿Estás seguro de que quieres vaciar la consola?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Limpiar', style: 'destructive', onPress: () => LogService.clearLogs() },
    ]);
  };

  const verDetalle = (item: LogEntry) => {
    Alert.alert(
      `[${item.level.toUpperCase()}] Detalle`,
      `Hora: ${item.timestamp}\n\nMensaje:\n${item.message}${
        item.extra ? `\n\nDetalles:\n${item.extra}` : ''
      }`,
      [{ text: 'Cerrar' }]
    );
  };

  const formatAllLogsText = () => {
    return logs
      .map((l) => `[${l.level.toUpperCase()}] [${l.timestamp}] ${l.message} ${l.extra || ''}`)
      .join('\n');
  };

  const renderLogItem = ({ item }: { item: LogEntry }) => {
    let textColor = 'text-stone-700';
    let borderColor = 'border-stone-300';
    let bgColor = 'bg-stone-50';

    if (item.level === 'warn') {
      textColor = 'text-amber-800';
      borderColor = 'border-amber-300';
      bgColor = 'bg-amber-50';
    } else if (item.level === 'error') {
      textColor = 'text-error-rojo';
      borderColor = 'border-red-300';
      bgColor = 'bg-red-50';
    }

    const timeStr = (item.timestamp.includes('T') ? item.timestamp.split('T')[1] : item.timestamp).slice(0, 8);

    return (
      <TouchableOpacity
        style={tw`p-3.5 rounded-2xl mb-2.5 border border-stone-200/70 shadow-xs ${bgColor}`}
        onPress={() => verDetalle(item)}
        activeOpacity={0.7}
      >
        <View style={tw`flex-row items-center justify-between mb-1.5`}>
          <Text style={tw`text-2xs font-mono font-bold text-texto-secundario`}>{timeStr}</Text>
          <View style={tw`px-2 py-0.5 rounded-md border ${borderColor}`}>
            <Text style={tw`text-2xs font-extrabold uppercase ${textColor}`}>{item.level}</Text>
          </View>
        </View>
        <Text style={tw`text-xs font-medium ${textColor} leading-4`} numberOfLines={2}>
          {item.message}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-beige-bg`} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={tw`flex-row items-center justify-between px-5 py-3.5 bg-beige-bg border-b border-stone-200/60`}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={tw`w-10 h-10 items-center justify-center rounded-xl bg-white shadow-sm border border-stone-200`}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={22} color="#1A3A5C" />
        </TouchableOpacity>

        <Text style={tw`text-lg font-bold text-azul-oscuro`}>Diagnóstico</Text>

        <View style={tw`flex-row items-center gap-2`}>
          <TouchableOpacity
            onPress={() => setModoTextoCopiar(!modoTextoCopiar)}
            style={tw`w-10 h-10 items-center justify-center rounded-xl bg-white shadow-sm border border-stone-200`}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name={modoTextoCopiar ? 'list' : 'content-copy'}
              size={20}
              color="#2C5F8A"
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleClear}
            style={tw`w-10 h-10 items-center justify-center rounded-xl bg-white shadow-sm border border-stone-200`}
            activeOpacity={0.7}
          >
            <MaterialIcons name="delete-sweep" size={22} color="#E85D5D" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={tw`flex-1 p-5`}>
        {modoTextoCopiar ? (
          <View style={tw`flex-1`}>
            <Text style={tw`text-xs text-texto-secundario mb-3 leading-4`}>
              Mantén pulsado el texto de abajo para seleccionar y copiar todos los logs:
            </Text>
            <TextInput
              style={tw`flex-1 p-4 bg-stone-900 text-green-400 font-mono text-xs rounded-2xl border border-stone-700`}
              multiline
              editable={false}
              selectTextOnFocus
              value={formatAllLogsText() || 'No hay logs registrados.'}
            />
          </View>
        ) : (
          <FlatList
            data={logs}
            keyExtractor={(item, index) => `${item.timestamp}-${index}`}
            renderItem={renderLogItem}
            contentContainerStyle={logs.length === 0 ? tw`flex-grow justify-center` : tw`pb-6`}
            ListEmptyComponent={
              <View style={tw`items-center justify-center py-16 px-6 bg-beige-card rounded-3xl border border-dashed border-stone-300`}>
                <MaterialIcons name="receipt" size={44} color="#6B6B6B" />
                <Text style={tw`text-base font-bold text-azul-oscuro text-center mt-3`}>
                  No hay logs registrados
                </Text>
                <Text style={tw`text-xs text-texto-secundario text-center mt-1`}>
                  Las operaciones Bluetooth y eventos del sistema se registrarán aquí en tiempo real.
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
