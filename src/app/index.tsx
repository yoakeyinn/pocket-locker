import { useEffect, useState } from 'react';
import { Animated, Easing, Image, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Estrella } from '../components/Estrella';
import { Text } from '../styles/tipografia/Tipografia';
import { t } from '../styles/i18n';
import { mostrarModal } from '../components/Modal';
import BluetoothService, { useBluetooth } from '../services/BluetoothService';
import { LogService } from '../services/StorageService';
import {
  APP_VERSION,
  ESTRELLAS,
  ESTRELLA_APAGADA,
  ESTRELLA_ENCENDIDA,
  splashAnimacion,
  splashEstilos,
  splashMedidas,
  tipografia,
} from '../styles/styles';

const SPLASH_DURACION_MS = 3000;
const SPLASH_FUNDIDO_MS = 250;

async function bluetoothApagado(): Promise<boolean> {
  try {
    return (await BluetoothService.esSoportado()) && !(await BluetoothService.estaEncendido());
  } catch (e) {
    LogService.warn('[Arranque] No se pudo comprobar el Bluetooth', e);
    return false;
  }
}

async function encenderBluetooth(): Promise<void> {
  try {
    if (await BluetoothService.solicitarPermisos()) await BluetoothService.pedirActivar();
  } catch (e) {
    LogService.error('[Arranque] No se pudo encender el Bluetooth', e);
  }
}

function avisarBluetoothApagado(): void {
  mostrarModal(t('pl_bt_apagado_titulo'), t('pl_bt_apagado_inicio_mensaje', { app: t('pl_app_titulo') }), [
    { text: t('pl_ir_ajustes'), onPress: () => BluetoothService.abrirAjustesBluetooth() },
    { text: t('pl_encender'), onPress: encenderBluetooth },
  ]);
}

const animar = (valor: Animated.Value, duration: number, easing: (x: number) => number) =>
  Animated.timing(valor, { toValue: 1, duration, easing, useNativeDriver: true });

export default function SplashScreen() {
  const { cargando, deviceMac, userName } = useBluetooth();
  const { width, height } = useWindowDimensions();
  const medidas = splashMedidas(width, height);
  const [listo, setListo] = useState(false);
  const [apagado, setApagado] = useState<boolean | null>(null);

  const [salida] = useState(() => new Animated.Value(1));
  const [entrada] = useState(() => new Animated.Value(0));
  const [progreso] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const aparicion = splashAnimacion.entrar(entrada);
    const carga = animar(progreso, SPLASH_DURACION_MS, Easing.linear);

    aparicion.start();
    carga.start(({ finished }) => finished && setListo(true));

    return () => {
      aparicion.stop();
      carga.stop();
    };
  }, [entrada, progreso]);

  useEffect(() => {
    let activo = true;
    bluetoothApagado().then((valor) => activo && setApagado(valor));
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    if (!cargando && listo && apagado !== null) {
      Animated.timing(salida, { toValue: 0, duration: SPLASH_FUNDIDO_MS, useNativeDriver: true }).start(() => {
        router.replace(!userName ? '/nombre' : deviceMac ? '/puertas' : '/buscar');
        if (apagado) avisarBluetoothApagado();
      });
    }
  }, [cargando, listo, apagado, salida, deviceMac, userName]);

  return (
    <Animated.View style={[splashEstilos.pantalla, { opacity: salida }]}>
      <Animated.View style={splashAnimacion.icono(entrada)}>
        <Image
          source={require('../../assets/splash-icon.png')}
          style={{ width: medidas.icono, height: medidas.icono }}
          resizeMode="contain"
          accessibilityLabel={t('pl_app_titulo')}
        />
      </Animated.View>

      <Animated.View style={[splashEstilos.tituloCaja, splashAnimacion.titulo(entrada)]}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[splashEstilos.titulo, { fontSize: medidas.titulo, letterSpacing: medidas.espaciadoTitulo }]}>
          {t('pl_app_titulo')}
        </Text>
      </Animated.View>

      <Animated.View style={splashAnimacion.tagline(entrada)}>
        <Text style={[tipografia.anotacion, splashEstilos.tagline, { fontSize: medidas.tagline, letterSpacing: medidas.espaciadoTagline }]}>{t('pl_tagline')}</Text>
      </Animated.View>

      <Animated.View style={[splashEstilos.barra, { marginTop: medidas.separacionBarra, opacity: entrada }]}>
        {ESTRELLAS.map((n) => (
          <View
            key={n}
            testID="splash-estrella"
            style={{ width: medidas.estrella, height: medidas.estrella, marginHorizontal: medidas.margenEstrella }}
          >
            <Estrella tamano={medidas.estrella} color={ESTRELLA_APAGADA} style={splashEstilos.encima} />
            <Animated.View style={[splashEstilos.encima, splashAnimacion.estrella(progreso, n)]}>
              <Estrella tamano={medidas.estrella} color={ESTRELLA_ENCENDIDA} />
            </Animated.View>
          </View>
        ))}
      </Animated.View>

      <Animated.View style={[splashEstilos.versionCaja, { opacity: entrada }]}>
        <Text style={splashEstilos.version}>v{APP_VERSION}</Text>
      </Animated.View>
    </Animated.View>
  );
}
