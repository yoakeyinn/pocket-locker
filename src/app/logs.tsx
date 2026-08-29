import React, { useState, useEffect } from 'react';
import {
  FlatList,
  StyleSheet,
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
import { Colors } from '../constants/Colors';

/**
 * Pantalla de Diagnóstico y Visor de Registros (Logs).
 * Permite a desarrolladores y técnicos inspeccionar en tiempo real las operaciones
 * Bluetooth, cambios de estado, tramas enviadas y posibles errores del sistema.
 */
export default function LogsScreen() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [modoTextoCopiar, setModoTextoCopiar] = useState(false);

  useEffect(() => {
    // Suscripción reactiva al servicio central de logging
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
    let color = '#555555';
    let bg = '#F5F5F5';
    if (item.level === 'warn') {
      color = '#B26A00';
      bg = '#FFF4E5';
    } else if (item.level === 'error') {
      color = Colors.errorRojo;
      bg = '#FCE8E6';
    }

    return (
      <TouchableOpacity
        style={[styles.logItem, { backgroundColor: bg }]}
        onPress={() => verDetalle(item)}
        activeOpacity={0.7}
      >
        <View style={styles.logMeta}>
          <Text style={[styles.logTime, { color }]}>{item.timestamp.split('T')[1].slice(0, 8)}</Text>
          <Text style={[styles.logLevel, { color, borderColor: color }]}>
            {item.level.toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.logMessage, { color }]} numberOfLines={2}>
          {item.message}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.btnHeader} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.azulOscuro} />
        </TouchableOpacity>
        <Text style={styles.tituloHeader}>Diagnóstico</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setModoTextoCopiar(!modoTextoCopiar)}
            style={styles.btnAction}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name={modoTextoCopiar ? 'list' : 'content-copy'}
              size={22}
              color={Colors.azulPrimario}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClear} style={styles.btnAction} activeOpacity={0.7}>
            <MaterialIcons name="delete-sweep" size={22} color={Colors.errorRojo} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {modoTextoCopiar ? (
          <View style={styles.textContainer}>
            <Text style={styles.textHelp}>
              Mantén pulsado el texto de abajo para seleccionar y copiar todos los logs:
            </Text>
            <TextInput
              style={styles.textInput}
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
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialIcons name="receipt" size={48} color="#CCCCCC" />
                <Text style={styles.emptyText}>No hay logs registrados en esta sesión.</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.beigeBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
    backgroundColor: '#FFFFFF',
  },
  btnHeader: {
    padding: 4,
  },
  tituloHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.azulOscuro,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  btnAction: {
    padding: 6,
  },
  content: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 8,
  },
  logItem: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  logMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  logTime: {
    fontSize: 12,
    fontWeight: '600',
  },
  logLevel: {
    fontSize: 10,
    fontWeight: 'bold',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  logMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    color: '#888888',
    fontSize: 14,
    textAlign: 'center',
  },
  textContainer: {
    flex: 1,
    padding: 16,
  },
  textHelp: {
    color: Colors.textoSecundario,
    fontSize: 12,
    marginBottom: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    fontFamily: 'monospace',
    fontSize: 11,
    textAlignVertical: 'top',
  },
});
