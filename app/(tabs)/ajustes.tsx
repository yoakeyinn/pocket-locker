import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { useBluetooth } from '../../context/BluetoothContext';

export default function AjustesScreen() {
  const {
    deviceMac,
    deviceName,
    desvincularDispositivo,
    renombrarDispositivo,
    modoSimulacion,
    setModoSimulacion,
  } = useBluetooth();

  const [modalVisible, setModalVisible] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [guardando, setGuardando] = useState(false);

  const abrirRenombrar = useCallback(() => {
    if (!deviceName) return;
    setNuevoNombre(deviceName);
    setModalVisible(true);
  }, [deviceName]);

  const confirmarRenombrar = useCallback(async () => {
    const nombreLimpio = nuevoNombre.trim();
    if (!nombreLimpio) return;
    setGuardando(true);
    try {
      await renombrarDispositivo(nombreLimpio);
      setModalVisible(false);
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el nombre del dispositivo');
    } finally {
      setGuardando(false);
    }
  }, [nuevoNombre, renombrarDispositivo]);

  const handleDesvincular = useCallback(() => {
    Alert.alert(
      'Desvincular dispositivo',
      '¿Estás seguro de que quieres eliminar este Pocket Locker? Se borrará de la memoria de la aplicación.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await desvincularDispositivo();
              Alert.alert('Eliminado', 'El dispositivo ha sido desvinculado con éxito');
            } catch {
              Alert.alert('Error', 'No se pudo desvincular el dispositivo');
            }
          },
        },
      ]
    );
  }, [desvincularDispositivo]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {modoSimulacion && (
        <View style={styles.bannerSimulacion}>
          <Text style={styles.bannerSimulacionTexto}>Modo Simulación Activo</Text>
        </View>
      )}
      <View style={styles.content}>
        <Text style={styles.header}>Ajustes</Text>
        <Text style={styles.helper}>Configura y gestiona tu aplicación Pocket Locker.</Text>

        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Dispositivo Vinculado</Text>
          {deviceMac ? (
            <View style={styles.tarjetaDispositivo}>
              <View style={styles.infoRow}>
                <MaterialIcons name="lock" size={24} color={Colors.azulPrimario} />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.deviceLabel}>Nombre</Text>
                  <Text style={styles.deviceName}>{deviceName}</Text>
                </View>
                <TouchableOpacity
                  style={styles.btnEditar}
                  onPress={abrirRenombrar}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="edit" size={20} color={Colors.azulPrimario} />
                </TouchableOpacity>
              </View>

              <View style={styles.divisor} />

              <View style={styles.infoRow}>
                <MaterialIcons name="fingerprint" size={24} color="#8A8A8A" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.deviceLabel}>Dirección MAC</Text>
                  <Text style={styles.deviceMac}>{deviceMac}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.btnEliminar}
                onPress={handleDesvincular}
                activeOpacity={0.8}
              >
                <MaterialIcons name="link-off" size={20} color={Colors.errorRojo} />
                <Text style={styles.btnEliminarTexto}>Eliminar dispositivo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.tarjetaVacia}>
              <MaterialIcons name="portable-wifi-off" size={32} color="#A2A2A2" />
              <Text style={styles.tarjetaVaciaTexto}>No hay ningún Pocket Locker vinculado actualmente</Text>
            </View>
          )}
        </View>

        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Desarrollo y Pruebas</Text>
          <View style={styles.tarjetaAjustes}>
            <View style={styles.ajusteRow}>
              <View style={styles.ajusteTexto}>
                <Text style={styles.ajusteLabel}>Modo Demostración</Text>
                <Text style={styles.ajusteDesc}>Simula la búsqueda y conexión sin hardware real</Text>
              </View>
              <Switch
                value={modoSimulacion}
                onValueChange={setModoSimulacion}
                trackColor={{ false: '#D2CFC7', true: '#C5D6C5' }}
                thumbColor={modoSimulacion ? Colors.exitoVerde : '#F4F3F0'}
              />
            </View>

            <View style={styles.divisor} />

            <TouchableOpacity
              style={styles.ajusteBotonRow}
              onPress={() => router.push('/logs')}
              activeOpacity={0.7}
            >
              <View style={styles.ajusteTexto}>
                <Text style={styles.ajusteLabel}>Ver Logs de Bluetooth</Text>
                <Text style={styles.ajusteDesc}>Depuración detallada del tráfico serie/BLE</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={Colors.textoSecundario} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Modal para Renombrar Dispositivo */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContent}
          >
            <Text style={styles.modalTitle}>Renombrar dispositivo</Text>
            <Text style={styles.modalSubtitle}>
              Escribe el nuevo nombre para tu Pocket Locker:
            </Text>

            <TextInput
              style={styles.modalInput}
              value={nuevoNombre}
              onChangeText={setNuevoNombre}
              placeholder="Nombre del Locker"
              placeholderTextColor="#999"
              autoFocus
              maxLength={24}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setModalVisible(false)}
                disabled={guardando}
              >
                <Text style={styles.modalButtonCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={confirmarRenombrar}
                disabled={guardando}
              >
                {guardando ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalButtonConfirmText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.beigeBg,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  header: {
    color: Colors.azulOscuro,
    fontSize: 22,
    fontWeight: 'bold',
  },
  helper: {
    color: Colors.textoSecundario,
    fontSize: 14,
    marginTop: 4,
    marginBottom: 24,
  },
  seccion: {
    marginBottom: 28,
  },
  seccionTitulo: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textoSecundario,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tarjetaDispositivo: {
    backgroundColor: Colors.beigeCard,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  tarjetaVacia: {
    backgroundColor: Colors.beigeCard,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D2CFC7',
  },
  tarjetaVaciaTexto: {
    color: Colors.textoSecundario,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  deviceLabel: {
    fontSize: 11,
    color: Colors.textoSecundario,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.azulOscuro,
    marginTop: 2,
  },
  deviceMac: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.azulOscuro,
    marginTop: 2,
  },
  btnEditar: {
    padding: 8,
  },
  divisor: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginVertical: 10,
  },
  btnEliminar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FCE8E6',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 18,
    gap: 8,
  },
  btnEliminarTexto: {
    color: Colors.errorRojo,
    fontSize: 14,
    fontWeight: '700',
  },
  tarjetaAjustes: {
    backgroundColor: Colors.beigeCard,
    borderRadius: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  ajusteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  ajusteBotonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  ajusteTexto: {
    flex: 1,
    marginRight: 16,
  },
  ajusteLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.azulOscuro,
  },
  ajusteDesc: {
    fontSize: 12,
    color: Colors.textoSecundario,
    marginTop: 2,
    lineHeight: 16,
  },
  bannerSimulacion: {
    backgroundColor: '#FFE0B2',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  bannerSimulacionTexto: {
    color: '#E65100',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: Colors.beigeCard,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'stretch',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.azulOscuro,
    marginBottom: 10,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.textoSecundario,
    marginBottom: 16,
    lineHeight: 18,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#D2CFC7',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: Colors.azulOscuro,
    backgroundColor: '#FAF9F6',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  modalButtonCancelText: {
    color: Colors.textoSecundario,
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtonConfirm: {
    backgroundColor: Colors.azulPrimario,
    minWidth: 80,
  },
  modalButtonConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
