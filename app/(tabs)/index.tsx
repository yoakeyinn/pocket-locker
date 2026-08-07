import { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
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
import BluetoothService, { DispositivoBT } from '../../services/BluetoothService';
import { useBluetooth } from '../../context/BluetoothContext';

export default function InicioScreen() {
  const {
    deviceMac,
    deviceName,
    status,
    actualizarDispositivoVinculado,
    modoSimulacion,
    setModoSimulacion,
    conectar,
  } = useBluetooth();

  const [escaneando, setEscaneando] = useState(false);
  const [dispositivos, setDispositivos] = useState<DispositivoBT[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [dispositivoSeleccionado, setDispositivoSeleccionado] = useState<DispositivoBT | null>(null);
  const [nombrePersonalizado, setNombrePersonalizado] = useState('');
  const [guardando, setGuardando] = useState(false);

  const buscarDispositivos = useCallback(async () => {
    setEscaneando(true);
    try {
      if (modoSimulacion) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setDispositivos([
          { name: 'Pocket Locker (SIMULADO)', address: '11:22:33:44:55:66', type: 'classic' },
        ]);
        return;
      }

      const soportado = await BluetoothService.esSoportado();
      if (!soportado) {
        Alert.alert(
          'Bluetooth no disponible',
          'Tu dispositivo no soporta Bluetooth Clásico'
        );
        return;
      }

      const encendido = await BluetoothService.estaEncendido();
      if (!encendido) {
        const activado = await BluetoothService.pedirActivar();
        if (!activado) {
          Alert.alert(
            'Bluetooth apagado',
            'Activa el Bluetooth para continuar'
          );
          return;
        }
      }

      const lista = await BluetoothService.listarDispositivos();
      setDispositivos(lista);

      if (lista.length === 0) {
        Alert.alert(
          'Sin dispositivos',
          'No se encontraron dispositivos vinculados. Asegúrate de que esté encendido y emparejado en los ajustes del sistema.'
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudieron buscar dispositivos');
    } finally {
      setEscaneando(false);
    }
  }, [modoSimulacion]);

  const iniciarVinculacion = useCallback((dispositivo: DispositivoBT) => {
    setDispositivoSeleccionado(dispositivo);
    setNombrePersonalizado(dispositivo.name.replace(' (SIMULADO)', ''));
    setModalVisible(true);
  }, []);

  const confirmarVinculacion = useCallback(async () => {
    if (!dispositivoSeleccionado) return;
    const nombre = nombrePersonalizado.trim() || dispositivoSeleccionado.name;
    setGuardando(true);
    try {
      await actualizarDispositivoVinculado(
        dispositivoSeleccionado.address,
        nombre,
        dispositivoSeleccionado.type || 'classic'
      );
      setModalVisible(false);
      router.push('/control');
    } catch {
      Alert.alert('Error', 'No se pudo guardar y vincular el dispositivo');
    } finally {
      setGuardando(false);
    }
  }, [dispositivoSeleccionado, nombrePersonalizado, actualizarDispositivoVinculado]);

  const entrarAlDispositivo = useCallback(async () => {
    if (status !== 'connected') {
      try {
        await conectar();
      } catch {
        // Ignorar fallos de reconexión inmediata, entramos de todos modos
      }
    }
    router.push('/control');
  }, [status, conectar]);

  const renderDeviceItem = useCallback(({ item }: { item: DispositivoBT }) => (
    <TouchableOpacity
      style={styles.deviceItem}
      onPress={() => iniciarVinculacion(item)}
      activeOpacity={0.7}
    >
      <MaterialIcons
        name="bluetooth"
        size={24}
        color={Colors.azulPrimario}
        style={styles.deviceIcon}
      />
      <View style={styles.deviceText}>
        <Text style={styles.deviceName}>{item.name}</Text>
        <Text style={styles.deviceMac}>{item.address}</Text>
      </View>
      <MaterialIcons
        name="chevron-right"
        size={24}
        color={Colors.textoSecundario}
      />
    </TouchableOpacity>
  ), [iniciarVinculacion]);

  useEffect(() => {
    if (!deviceMac) {
      buscarDispositivos();
    }
    return () => {
      BluetoothService.cancelarDescubrimiento().catch(() => {});
    };
  }, [deviceMac, buscarDispositivos]);

  // Si hay dispositivo guardado
  if (deviceMac) {
    let statusLabel = 'Desconectado';
    let statusColor = Colors.textoSecundario;

    if (status === 'connected') {
      statusLabel = 'Conectado';
      statusColor = Colors.exitoVerde;
    } else if (status === 'connecting') {
      statusLabel = 'Conectando...';
      statusColor = '#FF9800';
    }

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {modoSimulacion && (
          <View style={styles.bannerSimulacion}>
            <Text style={styles.bannerSimulacionTexto}>Modo Simulación Activo</Text>
          </View>
        )}
        <View style={styles.content}>
          <Text style={styles.header}>Mi Pocket Locker</Text>
          <Text style={styles.helper}>Pulsa en el locker para acceder a los controles.</Text>

          <TouchableOpacity
            style={styles.activeDeviceCard}
            onPress={entrarAlDispositivo}
            activeOpacity={0.9}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
              <Text style={[styles.cardStatusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>

            <View style={styles.cardMain}>
              <MaterialIcons name="lock" size={48} color={Colors.azulPrimario} />
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{deviceName}</Text>
                <Text style={styles.cardMac}>{deviceMac}</Text>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.cardFooterText}>Entrar a los controles</Text>
              <MaterialIcons name="arrow-forward" size={18} color={Colors.azulPrimario} />
            </View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Si NO hay dispositivo guardado (Escaneo)
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {modoSimulacion && (
        <TouchableOpacity
          onPress={() => setModoSimulacion(false)}
          style={styles.bannerSimulacion}
          activeOpacity={0.9}
        >
          <Text style={styles.bannerSimulacionTexto}>
            Modo Demo Activo (Toca para desactivar)
          </Text>
        </TouchableOpacity>
      )}
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.header}>Vincular dispositivo</Text>
          <TouchableOpacity
            testID="simulacion-toggle"
            onPress={() => setModoSimulacion(!modoSimulacion)}
            style={styles.btnSimulacion}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name={modoSimulacion ? 'bug-report' : 'developer-mode'}
              size={24}
              color={modoSimulacion ? Colors.errorRojo : Colors.textoSecundario}
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.helper}>
          Asegúrate de activar el Bluetooth y emparejar tu Pocket Locker en los ajustes del sistema.
        </Text>

        <TouchableOpacity
          style={[styles.boton, escaneando && styles.botonDisabled]}
          onPress={buscarDispositivos}
          disabled={escaneando}
          activeOpacity={0.85}
        >
          {escaneando ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <MaterialIcons name="search" size={20} color="#FFFFFF" />
              <Text style={styles.botonTexto}>Buscar dispositivos</Text>
            </>
          )}
        </TouchableOpacity>

        <FlatList
          data={dispositivos}
          keyExtractor={(item) => item.address}
          renderItem={renderDeviceItem}
          style={styles.lista}
          contentContainerStyle={
            dispositivos.length === 0 ? styles.listaVacia : undefined
          }
          refreshControl={
            <RefreshControl
              refreshing={escaneando}
              onRefresh={buscarDispositivos}
              colors={[Colors.azulPrimario]}
              tintColor={Colors.azulPrimario}
            />
          }
          ListEmptyComponent={
            !escaneando ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.vacio}>
                  Arrastra hacia abajo o pulsa &quot;Buscar dispositivos&quot; para buscar.
                </Text>
              </View>
            ) : null
          }
        />
      </View>

      {/* Modal para Nombre del Dispositivo */}
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
            <Text style={styles.modalTitle}>Asignar nombre</Text>
            <Text style={styles.modalSubtitle}>
              Introduce un nombre personalizado para identificar este Pocket Locker:
            </Text>

            <TextInput
              style={styles.modalInput}
              value={nombrePersonalizado}
              onChangeText={setNombrePersonalizado}
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
                onPress={confirmarVinculacion}
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
    marginBottom: 20,
  },
  boton: {
    flexDirection: 'row',
    backgroundColor: Colors.azulPrimario,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  botonDisabled: {
    opacity: 0.6,
  },
  botonTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  lista: {
    marginTop: 20,
    flex: 1,
  },
  listaVacia: {
    flex: 1,
    justifyContent: 'center',
  },
  vacio: {
    textAlign: 'center',
    color: Colors.textoSecundario,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  emptyContainer: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.beigeCard,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  deviceIcon: {
    marginRight: 12,
  },
  deviceText: {
    flex: 1,
  },
  deviceName: {
    color: Colors.azulOscuro,
    fontSize: 16,
    fontWeight: '600',
  },
  deviceMac: {
    color: Colors.textoSecundario,
    fontSize: 12,
    marginTop: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  btnSimulacion: {
    padding: 4,
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
  // Saved device view styles
  activeDeviceCard: {
    backgroundColor: Colors.beigeCard,
    borderRadius: 16,
    padding: 20,
    marginTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.03)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 20,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  cardStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardInfo: {
    marginLeft: 16,
  },
  cardName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.azulOscuro,
  },
  cardMac: {
    fontSize: 13,
    color: Colors.textoSecundario,
    marginTop: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 16,
  },
  cardFooterText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.azulPrimario,
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
