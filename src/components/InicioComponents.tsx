import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { BluetoothStatus, DispositivoBT } from '../services/BluetoothService';
import tw from '../styles';

// =============================================================================
// 1. ACTIVE LOCKER CARD
// =============================================================================

const CARD_STATUS_MAP: Record<string, { label: string; color: string }> = {
  connected: { label: 'Conectado', color: '#49A241' },
  connecting: { label: 'Conectando...', color: '#FF9800' },
};

export interface ActiveLockerCardProps {
  deviceName: string | null;
  deviceMac: string | null;
  status: BluetoothStatus;
  onPress: () => void;
}

export const ActiveLockerCard: React.FC<ActiveLockerCardProps> = ({
  deviceName,
  deviceMac,
  status,
  onPress,
}) => {
  const currentStatus = CARD_STATUS_MAP[status] || { label: 'Desconectado', color: '#6B6B6B' };

  return (
    <TouchableOpacity
      style={tw`bg-beige-card rounded-3xl p-6 shadow-md border border-stone-200/60 w-full`}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={tw`flex-row items-center justify-between mb-4`}>
        <View style={tw`flex-row items-center bg-stone-100 px-3 py-1 rounded-full`}>
          <View style={[tw`w-2 h-2 rounded-full mr-2`, { backgroundColor: currentStatus.color }]} />
          <Text style={[tw`text-xs font-bold`, { color: currentStatus.color }]}>
            {currentStatus.label}
          </Text>
        </View>
      </View>

      <View style={tw`flex-row items-center my-4`}>
        <View style={tw`w-16 h-16 rounded-2xl bg-azul-claro items-center justify-center mr-4`}>
          <MaterialIcons name="lock" size={36} color="#2C5F8A" />
        </View>
        <View style={tw`flex-1`}>
          <Text style={tw`text-xl font-extrabold text-azul-oscuro`} numberOfLines={1}>
            {deviceName || 'Pocket Locker'}
          </Text>
          <Text style={tw`text-xs text-texto-secundario mt-1 font-mono tracking-wider`}>
            {deviceMac}
          </Text>
        </View>
      </View>

      <View style={tw`flex-row items-center justify-between pt-4 border-t border-stone-100 mt-2`}>
        <Text style={tw`text-sm font-bold text-azul-primario`}>Entrar a los controles</Text>
        <View style={tw`w-8 h-8 rounded-full bg-azul-claro items-center justify-center`}>
          <MaterialIcons name="arrow-forward" size={16} color="#2C5F8A" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

// =============================================================================
// 2. RADAR SCANNER VIEW
// =============================================================================

export interface RadarScannerViewProps {
  userName: string | null;
  estadoTexto: string;
  estadoSubtexto: string;
  onCambiarAManual: () => void;
}

export const RadarScannerView: React.FC<RadarScannerViewProps> = ({
  userName,
  estadoTexto,
  estadoSubtexto,
  onCambiarAManual,
}) => {
  const radarPulse1 = useRef(new Animated.Value(1)).current;
  const radarPulse2 = useRef(new Animated.Value(1)).current;
  const radarOpacity1 = useRef(new Animated.Value(0.7)).current;
  const radarOpacity2 = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const cicloMs = 2200;
    const makePulse = (pulse: Animated.Value, opacity: Animated.Value, delayMs = 0) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delayMs),
          Animated.parallel([
            Animated.timing(pulse, { toValue: 2.2, duration: cicloMs, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: cicloMs, useNativeDriver: true }),
          ]),
          Animated.timing(pulse, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.7, duration: 0, useNativeDriver: true }),
        ])
      );

    const anim1 = makePulse(radarPulse1, radarOpacity1, 0);
    const anim2 = makePulse(radarPulse2, radarOpacity2, cicloMs / 2);
    anim1.start();
    anim2.start();

    return () => {
      anim1.stop();
      anim2.stop();
    };
  }, [radarPulse1, radarPulse2, radarOpacity1, radarOpacity2]);

  return (
    <SafeAreaView style={tw`flex-1 bg-beige-bg`} edges={['top', 'bottom']}>
      <View style={tw`flex-1 items-center justify-between p-6`}>
        <View style={tw`items-center mt-6`}>
          <Text style={tw`text-2xl font-bold text-azul-oscuro text-center`}>
            Buscando tu Pocket Locker
          </Text>
          <Text style={tw`text-sm text-texto-secundario text-center mt-1.5 px-4 leading-5`}>
            Configurando el acceso automáticamente para {userName || 'tu perfil'}
          </Text>
        </View>

        <View style={tw`items-center justify-center my-auto w-72 h-72`}>
          <Animated.View
            style={[
              tw`w-64 h-64 rounded-full absolute bg-azul-primario/15 border border-azul-primario/25`,
              { transform: [{ scale: radarPulse1 }], opacity: radarOpacity1 },
            ]}
          />
          <Animated.View
            style={[
              tw`w-52 h-52 rounded-full absolute bg-azul-primario/20 border border-azul-primario/30`,
              { transform: [{ scale: radarPulse2 }], opacity: radarOpacity2 },
            ]}
          />

          <View style={tw`w-28 h-28 rounded-full bg-azul-primario items-center justify-center shadow-xl border-4 border-white`}>
            <MaterialIcons name="lock-outline" size={48} color="#FFFFFF" />
          </View>
        </View>

        <View style={tw`w-full items-center mb-8`}>
          <View style={tw`flex-row items-center justify-center mb-2`}>
            <ActivityIndicator size="small" color="#2C5F8A" />
            <Text style={tw`text-base font-bold text-azul-oscuro ml-2.5`}>{estadoTexto}</Text>
          </View>
          <Text style={tw`text-xs text-texto-secundario text-center mb-6`}>{estadoSubtexto}</Text>

          <TouchableOpacity
            testID="btn-ir-manual"
            style={tw`py-3 px-6 rounded-2xl bg-white border border-stone-200 shadow-sm`}
            onPress={onCambiarAManual}
            activeOpacity={0.8}
          >
            <Text style={tw`text-xs font-bold text-azul-oscuro tracking-wider uppercase`}>
              Ver dispositivos manualmente
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

// =============================================================================
// 3. BLUETOOTH PERMISSION BLOCKED VIEW
// =============================================================================

export interface BluetoothPermissionBlockedViewProps {
  onConcederPermisos: () => Promise<void>;
  onAbrirAjustes: () => void;
}

export const BluetoothPermissionBlockedView: React.FC<BluetoothPermissionBlockedViewProps> = ({
  onConcederPermisos,
  onAbrirAjustes,
}) => (
  <SafeAreaView style={tw`flex-1 bg-beige-bg`} edges={['top', 'bottom']}>
    <View style={tw`flex-1 items-center justify-center p-6`}>
      <View style={tw`w-24 h-24 rounded-3xl bg-amber-100 items-center justify-center mb-6`}>
        <MaterialIcons name="security" size={48} color="#D97706" />
      </View>
      <Text style={tw`text-2xl font-bold text-azul-oscuro text-center mb-2`}>
        Permisos requeridos
      </Text>
      <Text style={tw`text-sm text-texto-secundario text-center mb-8 px-4 leading-5`}>
        Pocket Locker necesita permisos de Bluetooth y Ubicación para detectar y conectarse automáticamente a tu cerradura inteligente.
      </Text>

      <TouchableOpacity
        testID="btn-conceder-permisos"
        style={tw`w-full max-w-xs py-4 rounded-2xl bg-azul-primario items-center justify-center shadow-md mb-3`}
        onPress={onConcederPermisos}
        activeOpacity={0.85}
      >
        <Text style={tw`text-white font-bold text-sm tracking-wider uppercase`}>
          Conceder permisos
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="btn-abrir-ajustes-permisos"
        style={tw`w-full max-w-xs py-3.5 rounded-2xl bg-white border border-stone-200 items-center justify-center`}
        onPress={onAbrirAjustes}
        activeOpacity={0.85}
      >
        <Text style={tw`text-azul-oscuro font-bold text-xs tracking-wider uppercase`}>
          Abrir Ajustes del teléfono
        </Text>
      </TouchableOpacity>
    </View>
  </SafeAreaView>
);

// =============================================================================
// 4. DEVICE DISCOVERY LIST VIEW (con fila y vista vacía integradas)
// =============================================================================

export interface DeviceListItemProps {
  item: DispositivoBT;
  onPress: () => void;
}

export const DeviceListItem: React.FC<DeviceListItemProps> = ({ item, onPress }) => (
  <TouchableOpacity
    style={tw`flex-row items-center bg-beige-card p-4 rounded-2xl mb-3 border border-stone-200/60 shadow-sm`}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={tw`w-12 h-12 rounded-xl bg-azul-claro items-center justify-center mr-3.5`}>
      <MaterialIcons name="bluetooth" size={24} color="#2C5F8A" />
    </View>
    <View style={tw`flex-1`}>
      <Text style={tw`text-base font-bold text-azul-oscuro`} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={tw`text-xs text-texto-secundario font-mono mt-0.5`}>{item.address}</Text>
    </View>
    <MaterialIcons name="chevron-right" size={24} color="#6B6B6B" />
  </TouchableOpacity>
);

export interface EmptyDeviceListProps {
  onAbrirAjustes: () => void;
}

export const EmptyDeviceList: React.FC<EmptyDeviceListProps> = ({ onAbrirAjustes }) => (
  <View style={tw`items-center justify-center p-6 my-6 bg-beige-card rounded-3xl border border-dashed border-stone-300`}>
    <View style={tw`w-16 h-16 rounded-full bg-azul-claro items-center justify-center mb-4`}>
      <MaterialIcons name="bluetooth-searching" size={32} color="#2C5F8A" />
    </View>
    <Text style={tw`text-base font-bold text-azul-oscuro text-center`}>
      ¿No aparece tu Pocket Locker?
    </Text>
    <Text style={tw`text-xs text-texto-secundario text-center mt-2 mb-6 leading-5 px-4`}>
      Asegúrate de que tu Pocket Locker esté encendido y cerca de ti.
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

export interface DeviceDiscoveryListViewProps {
  dispositivos: DispositivoBT[];
  escaneando: boolean;
  refrescando: boolean;
  onBuscar: (desdePullToRefresh?: boolean) => void;
  onReintentarAuto: () => void;
  onSeleccionarDispositivo: (dispositivo: DispositivoBT) => void;
  onAbrirAjustesBluetooth: () => void;
}

export const DeviceDiscoveryListView: React.FC<DeviceDiscoveryListViewProps> = ({
  dispositivos,
  escaneando,
  refrescando,
  onBuscar,
  onReintentarAuto,
  onSeleccionarDispositivo,
  onAbrirAjustesBluetooth,
}) => (
  <SafeAreaView style={tw`flex-1 bg-beige-bg`} edges={['top']}>
    <View style={tw`flex-1 p-5`}>
      <Text style={tw`text-2xl font-bold text-azul-oscuro mb-1`}>Dispositivos cercanos</Text>
      <Text style={tw`text-sm text-texto-secundario mb-5`}>
        Dispositivos Bluetooth accesibles a tu alrededor. Pulsa en tu Pocket Locker para vincularlo.
      </Text>

      <View style={tw`flex-row items-center mb-4`}>
        <TouchableOpacity
          testID="btn-buscar-dispositivos"
          style={tw`flex-1 mr-2 flex-row items-center justify-center py-3.5 px-4 rounded-2xl bg-azul-primario shadow-sm ${
            escaneando || refrescando ? 'opacity-60' : ''
          }`}
          onPress={() => onBuscar(false)}
          disabled={escaneando || refrescando}
          activeOpacity={0.85}
        >
          {escaneando ? (
            <View style={tw`flex-row items-center justify-center`}>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={tw`text-white font-bold text-sm ml-2`}>Buscando...</Text>
            </View>
          ) : (
            <View style={tw`flex-row items-center justify-center`}>
              <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
              <Text style={tw`text-white font-bold text-sm ml-2`}>Recargar lista</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          testID="btn-reintentar-auto"
          style={tw`py-3.5 px-4 rounded-2xl bg-white border border-stone-200 shadow-sm items-center justify-center`}
          onPress={onReintentarAuto}
          activeOpacity={0.85}
        >
          <MaterialIcons name="radar" size={20} color="#2C5F8A" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={dispositivos}
        keyExtractor={(item) => item.address}
        renderItem={({ item }) => (
          <DeviceListItem item={item} onPress={() => onSeleccionarDispositivo(item)} />
        )}
        style={tw`flex-1`}
        contentContainerStyle={dispositivos.length === 0 ? tw`flex-grow justify-center` : tw`pb-6`}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => onBuscar(true)}
            colors={['#2C5F8A']}
            tintColor="#2C5F8A"
          />
        }
        ListEmptyComponent={
          !escaneando && !refrescando ? (
            <EmptyDeviceList onAbrirAjustes={onAbrirAjustesBluetooth} />
          ) : null
        }
        ListFooterComponent={
          dispositivos.length > 0 ? (
            <TouchableOpacity
              testID="btn-abrir-ajustes-footer"
              style={tw`flex-row items-center justify-center py-4 px-2`}
              onPress={onAbrirAjustesBluetooth}
              activeOpacity={0.7}
            >
              <MaterialIcons name="settings-bluetooth" size={18} color="#2C5F8A" />
              <Text style={tw`text-xs font-semibold text-azul-primario ml-2`}>
                Abrir Ajustes de Bluetooth del teléfono
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />
    </View>
  </SafeAreaView>
);

// =============================================================================
// 5. MODAL VINCULAR DISPOSITIVO
// =============================================================================

export interface ModalVincularDispositivoProps {
  visible: boolean;
  guardando: boolean;
  userName?: string | null;
  nombrePersonalizado: string;
  setNombrePersonalizado: (val: string) => void;
  pinSeguridad: string;
  setPinSeguridad: (val: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ModalVincularDispositivo: React.FC<ModalVincularDispositivoProps> = ({
  visible,
  guardando,
  nombrePersonalizado,
  setNombrePersonalizado,
  pinSeguridad,
  setPinSeguridad,
  onCancel,
  onConfirm,
}) => (
  <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel} statusBarTranslucent>
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={tw`flex-1 bg-black/60 justify-center items-center`}
    >
      <ScrollView
        style={tw`w-full`}
        contentContainerStyle={tw`flex-grow justify-center items-center px-4 py-6`}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={tw`w-full max-w-sm bg-beige-card rounded-3xl p-6 shadow-2xl border border-stone-100`}>
          <Text style={tw`text-xl font-bold text-azul-oscuro mb-2`}>Vincular Dispositivo</Text>
          <Text style={tw`text-xs text-texto-secundario mb-5 leading-5`}>
            Introduce el PIN de seguridad (2415) para vincular este Pocket Locker:
          </Text>

          <Text style={tw`text-xs font-bold text-texto-secundario uppercase mb-1.5 tracking-wider`}>
            Nombre del dispositivo
          </Text>
          <TextInput
            style={tw`border border-stone-300 rounded-xl px-4 py-2.5 text-base text-azul-oscuro bg-stone-50 mb-4`}
            value={nombrePersonalizado}
            onChangeText={setNombrePersonalizado}
            maxLength={24}
          />

          <Text style={tw`text-xs font-bold text-texto-secundario uppercase mb-1.5 tracking-wider`}>
            PIN de seguridad
          </Text>
          <TextInput
            style={tw`border border-stone-300 rounded-xl px-4 py-2.5 text-base text-azul-oscuro bg-stone-50 mb-5`}
            value={pinSeguridad}
            onChangeText={setPinSeguridad}
            keyboardType="number-pad"
            maxLength={8}
          />

          {guardando && (
            <View style={tw`flex-row items-center bg-blue-50 border border-blue-200 p-3 rounded-xl mb-4`}>
              <ActivityIndicator color="#2C5F8A" size="small" />
              <Text style={tw`text-xs text-azul-primario ml-2.5 flex-1 leading-4`}>
                Vinculando... Si tu móvil solicita el PIN Bluetooth en una notificación, introduce 2415.
              </Text>
            </View>
          )}

          <View style={tw`flex-row justify-end gap-3`}>
            <TouchableOpacity
              style={tw`px-4 py-2.5 rounded-xl bg-stone-100`}
              onPress={onCancel}
              disabled={guardando}
            >
              <Text style={tw`text-sm font-semibold text-texto-secundario`}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={tw`px-5 py-2.5 rounded-xl bg-azul-primario`}
              onPress={onConfirm}
              disabled={guardando}
            >
              <Text style={tw`text-sm font-bold text-white`}>Vincular</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </Modal>
);
