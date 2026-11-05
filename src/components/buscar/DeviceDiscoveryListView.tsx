import React from 'react';
import { View, useWindowDimensions, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Aparece, ENTRADA_LENTA_MS, PASO_ENTRADA_MS } from '../Aparece';
import { Boton } from '../Boton';
import { BotonIcono } from '../BotonIcono';
import { DispositivoBT } from '../../services/BluetoothService';
import { Text } from '../../styles/tipografia/Tipografia';
import { t } from '../../styles/i18n';
import tw, { Colors, tipografia } from '../../styles/styles';
import { AvisoBluetoothApagado } from './AvisoBluetoothApagado';
import { DeviceListItem } from './DeviceListItem';

export interface DeviceDiscoveryListViewProps {
  dispositivos: DispositivoBT[];
  escaneando: boolean;
  refrescando: boolean;
  onBuscar: (desdePullToRefresh?: boolean) => void;
  onReintentarAuto: () => void;
  onSeleccionarDispositivo: (dispositivo: DispositivoBT) => void;
  onIrAjustes: () => void;
  bluetoothApagado?: boolean;
  onActivarBluetooth: () => void;
  onAbrirAjustesBluetooth: () => void;
  bluetoothNoDisponible?: boolean;
}

export const DeviceDiscoveryListView: React.FC<DeviceDiscoveryListViewProps> = ({
  dispositivos,
  escaneando,
  refrescando,
  onBuscar,
  onReintentarAuto,
  onSeleccionarDispositivo,
  onIrAjustes,
  bluetoothApagado,
  onActivarBluetooth,
  onAbrirAjustesBluetooth,
  bluetoothNoDisponible,
}) => {
  const { width, height } = useWindowDimensions();
  const tamanoTitulo = Math.round(Math.min(40, Math.max(28, width * 0.085)));
  const margenSuperior = Math.round(Math.min(40, Math.max(16, height * 0.04)));

  const buscando = escaneando || refrescando;

  const cabecera = (
    <View>
      <Aparece duracion={ENTRADA_LENTA_MS}>
        <Text style={[tipografia.titulo, { fontSize: tamanoTitulo, lineHeight: Math.round(tamanoTitulo * 1.2) }]}>
          {t('pl_dispositivos_cercanos')}
        </Text>
      </Aparece>
      <Aparece duracion={ENTRADA_LENTA_MS} retraso={PASO_ENTRADA_MS} style={tw`mt-4 mb-6`}>
        <Text style={[tipografia.anotacion, { lineHeight: 22 }]}>
          {t('pl_buscar_ayuda', { app: t('pl_app_titulo') })}
        </Text>
      </Aparece>

      {bluetoothNoDisponible && (
        <Aparece duracion={ENTRADA_LENTA_MS} retraso={PASO_ENTRADA_MS * 2} style={tw`mb-5`}>
          <View
            testID="aviso-sin-bluetooth"
            style={tw`flex-row items-center border border-red/30 rounded-lg px-3 py-2`}
          >
            <Feather name="alert-triangle" size={15} color={Colors.red} />
            <Text
              style={[
                tipografia.error,
                tw`flex-1 text-left ml-2.5`,
                { lineHeight: 15, includeFontPadding: false, textAlignVertical: 'center' },
              ]}
            >
              {t('pl_aviso_sin_bluetooth')}
            </Text>
          </View>
        </Aparece>
      )}

      {bluetoothApagado && <AvisoBluetoothApagado onActivar={onActivarBluetooth} onAbrirAjustes={onAbrirAjustesBluetooth} />}

      <Aparece duracion={ENTRADA_LENTA_MS} retraso={PASO_ENTRADA_MS * 2} style={tw`flex-row items-center mb-5`}>
        <Boton
          testID="btn-buscar-dispositivos"
          relleno
          cargando={buscando}
          texto={buscando ? t('pl_buscando_estado') : t('pl_buscar_de_nuevo')}
          deshabilitado={buscando}
          onPress={() => onBuscar(false)}
          style={tw`flex-1 mr-2.5`}
        />
        <BotonIcono conBoton testID="btn-reintentar-auto" icono="radar" onPress={onReintentarAuto} />
        <View style={tw`ml-2.5`}>
          <BotonIcono conBoton testID="btn-ajustes" icono="settings" onPress={onIrAjustes} />
        </View>
      </Aparece>
    </View>
  );

  return (
    <SafeAreaView style={tw`flex-1 bg-beige`} edges={['top', 'bottom']}>
      <FlatList
        testID="lista-dispositivos"
        data={bluetoothApagado ? [] : dispositivos}
        keyExtractor={(item) => item.address}
        renderItem={({ item, index }) => (
          <DeviceListItem item={item} indice={index} onPress={() => onSeleccionarDispositivo(item)} />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[tw`px-6 pb-8`, { paddingTop: margenSuperior }]}
        ListHeaderComponent={cabecera}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => onBuscar(true)}
            colors={[Colors.black]}
            tintColor={Colors.black}
            progressBackgroundColor={Colors.white}
          />
        }
        ListEmptyComponent={
          !escaneando && !refrescando && !bluetoothNoDisponible && !bluetoothApagado ? (
            <Aparece duracion={ENTRADA_LENTA_MS} retraso={PASO_ENTRADA_MS * 3} style={tw`items-center py-6`}>
              <Text testID="sin-resultados" style={[tipografia.anotacion, tw`text-xs text-center`]}>
                {t('pl_sin_resultados')}
              </Text>
            </Aparece>
          ) : undefined
        }
      />
    </SafeAreaView>
  );
};
