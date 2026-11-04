import React, { useEffect, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  Easing,
  useWindowDimensions,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Aparece, retrasoEscalonado } from '../Aparece';
import { Boton } from '../Boton';
import { Campo } from '../Campo';
import { Cargando } from '../Cargando';
import { Estrella } from '../Estrella';
import { Modal } from '../Modal';
import { DispositivoBT, SIN_NOMBRE } from '../../services/BluetoothService';
import { DEFAULT_SECURITY_PIN, modoSimulacion } from '../../services/comun';
import { Text } from '../../styles/tipografia/Tipografia';
import { t } from '../../styles/i18n';
import tw, { Colors, ESTRELLA_APAGADA, ESTRELLA_ENCENDIDA, cicloPulso, splashAnimacion, tipografia } from '../../styles/styles';

const ORBITAS = [
  { fraccion: 1 / 4, desfase: 0, duracion: 7000 },
  { fraccion: 7 / 16, desfase: 72, duracion: 11000 },
  { fraccion: 5 / 8, desfase: 144, duracion: 7000 },
  { fraccion: 13 / 16, desfase: 216, duracion: 11000 },
  { fraccion: 1, desfase: 288, duracion: 7000 },
];
const LADO_RADAR_MAXIMO = 288;
const ESTRELLA_RADAR = 24;
const OPACIDAD_ORBITA = 1;
const ORBITA_OBJETIVO = 2;
const ANCHO_TITULO_EM = 7.5;
const ANGULO_OBJETIVO = (50 * Math.PI) / 180;

export interface RadarScannerViewProps {
  encontrado: boolean;
  onCambiarAManual: () => void;
}

export const RadarScannerView: React.FC<RadarScannerViewProps> = ({ encontrado, onCambiarAManual }) => {
  const { width, height } = useWindowDimensions();
  const lado = Math.round(Math.min(LADO_RADAR_MAXIMO, width - 64, height * 0.4));
  const diametros = ORBITAS.map(({ fraccion }) => (lado - ESTRELLA_RADAR) * fraccion);
  const radioObjetivo = diametros[ORBITA_OBJETIVO] / 2;
  const posicionObjetivo = {
    left: lado / 2 + radioObjetivo * Math.sin(ANGULO_OBJETIVO) - ESTRELLA_RADAR / 2,
    top: lado / 2 - radioObjetivo * Math.cos(ANGULO_OBJETIVO) - ESTRELLA_RADAR / 2,
  };
  const tamanoTitulo = Math.round(Math.min(48, Math.max(28, width * 0.1)));
  const estiloTitulo = [
    tipografia.titulo,
    tw`text-center`,
    { fontSize: tamanoTitulo, lineHeight: Math.round(tamanoTitulo * 1.2) },
  ];

  const [entrada] = useState(() => new Animated.Value(0));
  const [giros] = useState(() => ORBITAS.map(() => new Animated.Value(0)));
  const [estrellas] = useState(() => new Animated.Value(OPACIDAD_ORBITA));
  const [objetivo] = useState(() => new Animated.Value(0));
  const [pingEscala] = useState(() => new Animated.Value(1));
  const [pingOpacidad] = useState(() => new Animated.Value(0.8));

  useEffect(() => {
    const aparicion = splashAnimacion.entrar(entrada);
    aparicion.start();
    return () => aparicion.stop();
  }, [entrada]);

  useEffect(() => {
    if (encontrado) {
      const hallazgo = Animated.parallel([
        Animated.timing(estrellas, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.spring(objetivo, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
      ]);
      const ping = Animated.loop(
        cicloPulso(pingEscala, pingOpacidad, { escala: 3.2, opacidadInicial: 0.8, duracion: 1200 })
      );
      hallazgo.start();
      ping.start();
      return () => {
        hallazgo.stop();
        ping.stop();
      };
    }

    estrellas.setValue(OPACIDAD_ORBITA);
    objetivo.setValue(0);
    const vueltas = giros.map((giro, i) => {
      giro.setValue(0);
      return Animated.loop(
        Animated.timing(giro, { toValue: 1, duration: ORBITAS[i].duracion, easing: Easing.linear, useNativeDriver: true })
      );
    });
    vueltas.forEach((vuelta) => vuelta.start());
    return () => vueltas.forEach((vuelta) => vuelta.stop());
  }, [encontrado, giros, estrellas, objetivo, pingEscala, pingOpacidad]);

  return (
    <SafeAreaView style={tw`flex-1 bg-beige`} edges={['top', 'bottom']}>
      <View style={tw`flex-1 items-center justify-between p-6`}>
        <Animated.View
          style={[
            { width: tamanoTitulo * ANCHO_TITULO_EM, maxWidth: '90%', marginTop: Math.round(height * 0.07) },
            splashAnimacion.titulo(entrada),
          ]}
        >
          <Text numberOfLines={2} adjustsFontSizeToFit style={estiloTitulo}>
            {t('pl_buscando', { app: t('pl_app_titulo') })}
          </Text>
        </Animated.View>

        <View style={[tw`items-center justify-center my-auto`, { width: lado, height: lado }]}>
          {diametros.map((diametro) => (
            <View
              key={diametro}
              style={[tw`absolute rounded-full border border-silver`, { width: diametro, height: diametro }]}
            />
          ))}

          <Animated.View
            testID="radar-estrellas"
            pointerEvents="none"
            style={[tw`absolute items-center justify-center`, { width: lado, height: lado, opacity: estrellas }]}
          >
            {ORBITAS.map(({ desfase }, i) => {
              const sentido = i % 2 === 0 ? 360 : -360;
              const rotar = giros[i].interpolate({
                inputRange: [0, 1],
                outputRange: [`${desfase}deg`, `${desfase + sentido}deg`],
              });
              return (
                <Animated.View
                  key={i}
                  style={[tw`absolute`, { width: diametros[i], height: diametros[i], transform: [{ rotate: rotar }] }]}
                >
                  <View style={[tw`absolute`, { top: -ESTRELLA_RADAR / 2, left: diametros[i] / 2 - ESTRELLA_RADAR / 2 }]}>
                    <Estrella tamano={ESTRELLA_RADAR} color={ESTRELLA_APAGADA} />
                  </View>
                </Animated.View>
              );
            })}
          </Animated.View>

          {encontrado && (
            <Animated.View
              testID="radar-objetivo"
              style={[
                tw`absolute`,
                { width: ESTRELLA_RADAR, height: ESTRELLA_RADAR },
                posicionObjetivo,
                { transform: [{ scale: objetivo }] },
              ]}
            >
              <Animated.View
                style={[
                  tw`absolute`,
                  { top: 0, left: 0, width: ESTRELLA_RADAR, height: ESTRELLA_RADAR },
                  { opacity: pingOpacidad, transform: [{ scale: pingEscala }] },
                ]}
              >
                <Estrella tamano={ESTRELLA_RADAR} color={ESTRELLA_ENCENDIDA} contorno />
              </Animated.View>
              <Estrella tamano={ESTRELLA_RADAR} color={ESTRELLA_ENCENDIDA} />
            </Animated.View>
          )}
        </View>

        <View style={tw`w-full items-center mb-8`}>
          <Animated.View style={splashAnimacion.titulo(entrada)}>
            <Boton testID="btn-ir-manual" texto={t('pl_ver_dispositivos')} onPress={onCambiarAManual} style={tw`px-7`} />
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export interface BluetoothPermissionBlockedViewProps {
  onConcederPermisos: () => Promise<void>;
  onAbrirAjustes: () => void;
}

export const BluetoothPermissionBlockedView: React.FC<BluetoothPermissionBlockedViewProps> = ({
  onConcederPermisos,
  onAbrirAjustes,
}) => (
  <SafeAreaView style={tw`flex-1 bg-beige`} edges={['top', 'bottom']}>
    <View style={tw`flex-1 items-center justify-center p-6`}>
      <Aparece style={tw`items-center`}>
        <View style={tw`w-20 h-20 rounded-full border border-silver bg-white items-center justify-center mb-6`}>
          <MaterialIcons name="security" size={36} color={Colors.black} />
        </View>
        <Text style={[tipografia.titulo, tw`text-3xl text-center mb-3`]}>{t('pl_permisos_titulo')}</Text>
        <Text style={[tipografia.anotacion, tw`text-center mb-8 px-2`, { lineHeight: 22 }]}>
          {t('pl_permisos_mensaje', { app: t('pl_app_titulo') })}
        </Text>
        <Boton
          relleno
          testID="btn-conceder-permisos"
          texto={t('pl_conceder_permisos')}
          onPress={onConcederPermisos}
          style={tw`w-64 mb-3`}
        />
        <Boton
          testID="btn-abrir-ajustes-permisos"
          texto={t('pl_abrir_ajustes_telefono')}
          onPress={onAbrirAjustes}
          style={tw`w-64`}
        />
      </Aparece>
    </View>
  </SafeAreaView>
);

export interface DeviceListItemProps {
  item: DispositivoBT;
  onPress: () => void;
  indice?: number;
  onMedir?: (alto: number) => void;
}

// Separación entre filas (`mb-3`); se suma al alto medido de la tarjeta para saber cuántas caben.
const MARGEN_FILA = 12;

export const DeviceListItem: React.FC<DeviceListItemProps> = ({ item, onPress, indice = 0, onMedir }) => (
  <Aparece retraso={retrasoEscalonado(indice)} style={{ marginBottom: MARGEN_FILA }}>
    <TouchableOpacity
      style={tw`flex-row items-center bg-white px-4 py-3.5 rounded-lg border border-silver`}
      onPress={onPress}
      onLayout={onMedir && ((e) => onMedir(e.nativeEvent.layout.height))}
      activeOpacity={0.7}
    >
      <View style={tw`w-11 h-11 rounded-lg border border-silver bg-beige items-center justify-center mr-4`}>
        <MaterialIcons name="bluetooth" size={22} color={Colors.black} />
      </View>
      <View style={tw`flex-1`}>
        <Text style={[tipografia.texto, tw`text-base`]} numberOfLines={1}>
          {item.name === SIN_NOMBRE ? t('pl_sin_nombre') : item.name}
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={22} color={Colors.black} />
    </TouchableOpacity>
  </Aparece>
);

export interface AvisoNoApareceProps {
  onAbrirAjustes: () => void;
}

// Ayuda compacta que va siempre al pie de la pantalla, haya o no dispositivos.
// El borde discontinuo la distingue de las tarjetas de dispositivo.
export const AvisoNoAparece: React.FC<AvisoNoApareceProps> = ({ onAbrirAjustes }) => (
  <View style={tw`border border-dashed border-gray rounded-lg bg-beige p-5`}>
    <View style={tw`flex-row items-center`}>
      <MaterialIcons name="info-outline" size={22} color={Colors.black} style={tw`mr-2.5`} />
      <Text style={[tipografia.titulo, tw`flex-1 text-lg`]}>{t('pl_no_aparece_titulo', { app: t('pl_app_titulo') })}</Text>
    </View>
    <Text style={[tipografia.anotacion, tw`text-xs mt-2`, { lineHeight: 18 }]}>{t('pl_no_aparece_mensaje')}</Text>
    <Boton
      compacto
      testID="btn-abrir-ajustes"
      texto={t('pl_abrir_ajustes_bluetooth')}
      onPress={onAbrirAjustes}
      style={tw`mt-4`}
    />
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
  bluetoothNoDisponible?: boolean;
}

// Alto de una fila (tarjeta + margen) mientras no se haya medido la primera, y del botón «Ver más».
export const ALTO_FILA = 84;
export const ALTO_VER_MAS = 48;
const FILAS_MINIMAS = 2;
const FILAS_MAXIMAS = 3;

// Cuántos dispositivos se enseñan antes de «Ver más»: entre 2 y 3 según el alto libre de la pantalla.
export const filasVisibles = (altoDisponible: number, altoFila: number = ALTO_FILA): number =>
  altoDisponible > 0
    ? Math.min(FILAS_MAXIMAS, Math.max(FILAS_MINIMAS, Math.floor((altoDisponible - ALTO_VER_MAS) / altoFila)))
    : FILAS_MAXIMAS;

export const DeviceDiscoveryListView: React.FC<DeviceDiscoveryListViewProps> = ({
  dispositivos,
  escaneando,
  refrescando,
  onBuscar,
  onReintentarAuto,
  onSeleccionarDispositivo,
  onAbrirAjustesBluetooth,
  bluetoothNoDisponible,
}) => {
  const { width, height } = useWindowDimensions();
  const tamanoTitulo = Math.round(Math.min(40, Math.max(28, width * 0.085)));
  const margenSuperior = Math.round(Math.min(40, Math.max(16, height * 0.04)));

  const [altoLista, setAltoLista] = useState(0);
  const [altoFila, setAltoFila] = useState(ALTO_FILA);
  const [expandida, setExpandida] = useState(false);
  const visibles = filasVisibles(altoLista, altoFila);
  const hayMas = dispositivos.length > visibles;
  const mostrados = expandida || !hayMas ? dispositivos : dispositivos.slice(0, visibles);

  useEffect(() => {
    if (!hayMas) setExpandida(false);
  }, [hayMas]);

  return (
    <SafeAreaView style={tw`flex-1 bg-beige`} edges={['top', 'bottom']}>
      <View style={[tw`flex-1 px-6`, { paddingTop: margenSuperior }]}>
        <Aparece>
          <Text
            style={[tipografia.titulo, { fontSize: tamanoTitulo, lineHeight: Math.round(tamanoTitulo * 1.2) }]}
          >
            {t('pl_dispositivos_cercanos')}
          </Text>
        </Aparece>
        <Aparece retraso={120} style={tw`mt-4 mb-6`}>
          <Text style={[tipografia.anotacion, { lineHeight: 22 }]}>
            {t('pl_buscar_ayuda', { app: t('pl_app_titulo') })}
          </Text>
        </Aparece>

        {bluetoothNoDisponible && (
          <Aparece retraso={200} style={tw`mb-5`}>
            <View
              testID="aviso-sin-bluetooth"
              style={tw`flex-row items-start border border-silver rounded-lg p-3.5`}
            >
              <MaterialIcons name="info-outline" size={18} color={Colors.gray} style={tw`mt-0.5`} />
              <Text style={[tipografia.anotacion, tw`flex-1 text-xs ml-2.5`, { lineHeight: 18 }]}>
                {t('pl_aviso_sin_bluetooth')}
              </Text>
            </View>
          </Aparece>
        )}

        <Aparece retraso={240} style={tw`flex-row items-center mb-5`}>
          <Boton
            testID="btn-buscar-dispositivos"
            relleno
            cargando={escaneando}
            texto={escaneando ? t('pl_buscando_estado') : t('pl_buscar_de_nuevo')}
            deshabilitado={escaneando || refrescando}
            onPress={() => onBuscar(false)}
            style={tw`flex-1 mr-2.5`}
          />
          <Boton testID="btn-reintentar-auto" icono="radar" onPress={onReintentarAuto} />
        </Aparece>

        <View style={tw`flex-1`} onLayout={(e) => setAltoLista(e.nativeEvent.layout.height)}>
          <FlatList
            data={mostrados}
            keyExtractor={(item) => item.address}
            renderItem={({ item, index }) => (
              <DeviceListItem
                item={item}
                indice={index}
                onPress={() => onSeleccionarDispositivo(item)}
                onMedir={index === 0 ? (alto) => setAltoFila(Math.round(alto) + MARGEN_FILA) : undefined}
              />
            )}
            style={tw`flex-1`}
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
              !escaneando && !refrescando && !bluetoothNoDisponible ? (
                <Aparece style={tw`items-center py-6`}>
                  <Text testID="sin-resultados" style={[tipografia.anotacion, tw`text-xs text-center`]}>
                    {t('pl_sin_resultados')}
                  </Text>
                </Aparece>
              ) : undefined
            }
            ListFooterComponent={
              hayMas ? (
                <TouchableOpacity
                  testID="btn-ver-mas"
                  onPress={() => setExpandida((actual) => !actual)}
                  activeOpacity={0.6}
                  hitSlop={{ top: 8, bottom: 8, left: 24, right: 24 }}
                  style={tw`self-center py-1`}
                >
                  <Text style={[tipografia.anotacion, tw`text-xs`]}>
                    {expandida
                      ? t('pl_ver_menos')
                      : t('pl_ver_mas', { cantidad: String(dispositivos.length - visibles) })}
                  </Text>
                </TouchableOpacity>
              ) : undefined
            }
          />
        </View>

        <Aparece retraso={retrasoEscalonado(mostrados.length, 120)} style={tw`mt-4 mb-5`}>
          <AvisoNoAparece onAbrirAjustes={onAbrirAjustesBluetooth} />
        </Aparece>
      </View>
    </SafeAreaView>
  );
};

export interface ModalVincularDispositivoProps {
  visible: boolean;
  guardando: boolean;
  nombrePersonalizado: string;
  setNombrePersonalizado: (val: string) => void;
  errorNombre?: string | null;
  pinSeguridad: string;
  setPinSeguridad: (val: string) => void;
  errorPin?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ModalVincularDispositivo: React.FC<ModalVincularDispositivoProps> = ({
  visible,
  guardando,
  nombrePersonalizado,
  setNombrePersonalizado,
  errorNombre,
  pinSeguridad,
  setPinSeguridad,
  errorPin,
  onCancel,
  onConfirm,
}) => {
  const app = t('pl_app_titulo');
  // El PIN de la demo solo se enseña en la simulación (npm run simular); un usuario normal nunca lo ve.
  const simulando = modoSimulacion() !== '';
  return (
    <Modal
      visible={visible}
      titulo={t('pl_vincular_dispositivo')}
      mensaje={
        simulando
          ? t('pl_vincular_pin_mensaje_simulacion', { pin: DEFAULT_SECURITY_PIN, app })
          : t('pl_vincular_pin_mensaje', { app })
      }
      izquierdo={{ texto: t('pl_cancelar'), onPress: onCancel, deshabilitado: guardando }}
      derecho={{ texto: t('pl_vincular'), onPress: onConfirm, deshabilitado: guardando }}
      onCerrar={onCancel}
    >
      <Campo
        id="nombre"
        etiqueta={t('pl_nombre_dispositivo')}
        error={errorNombre}
        value={nombrePersonalizado}
        onChangeText={setNombrePersonalizado}
        maxLength={24}
      />
      <Campo
        id="pin"
        clase="mt-4"
        etiqueta={t('pl_pin_seguridad')}
        error={errorPin}
        value={pinSeguridad}
        onChangeText={setPinSeguridad}
        autoCapitalize="characters"
        maxLength={9}
      />

      {guardando && (
        <View style={tw`flex-row items-center mt-4`}>
          <Cargando tamano={20} />
          <Text style={tw`text-xs font-light text-gray ml-2.5 flex-1 leading-4`}>
            {simulando ? t('pl_vinculando_ayuda_simulacion', { pin: DEFAULT_SECURITY_PIN }) : t('pl_vinculando_ayuda')}
          </Text>
        </View>
      )}
    </Modal>
  );
};
