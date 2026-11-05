import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Estrella } from '../components/Estrella';
import { Text } from '../styles/tipografia/Tipografia';
import { t, useIdioma } from '../styles/i18n';
import { useBluetooth } from '../services/BluetoothService';
import { avisarBluetoothApagado, bluetoothApagado } from '../services/AvisoBluetooth';
import { marcarArranque } from '../services/arranque';
import { rutaInicial } from '../services/comun';
import { useMargenesSeguros } from '../styles/margenes';
import { Biometria } from '../services/Biometria';
import { marcarDesbloqueada, usePreferencias } from '../services/preferencias';
import {
  APP_VERSION,
  ESTRELLAS,
  Colors,
  useTema,
  forzarTemaClaro,
  splashAnimacion,
  splashEstilos,
  splashMedidas,
  tipografia,
} from '../styles/styles';

const SPLASH_PRIMERA_VEZ_MS = 3000;
const SPLASH_HABITUAL_MS = 1000;
const SPLASH_FUNDIDO_MS = 250;
const REINTENTO_VERIFICACION_MS = 1000;

const animar = (valor: Animated.Value, duration: number, easing: (x: number) => number) =>
  Animated.timing(valor, { toValue: 1, duration, easing, useNativeDriver: true });

export default function SplashScreen() {
  useIdioma();
  useTema();
  const { biometria, desbloqueada, cargadas } = usePreferencias();
  const { cargando, deviceMac, userName } = useBluetooth();
  const { width, height } = useWindowDimensions();
  const medidas = splashMedidas(width, height);
  const margenes = useMargenesSeguros();
  const [listo, setListo] = useState(false);
  const [apagado, setApagado] = useState<boolean | null>(null);
  const verificandoRef = useRef(false);
  const bloquear = biometria && !desbloqueada;

  const [salida] = useState(() => new Animated.Value(1));
  const [entrada] = useState(() => new Animated.Value(0));
  const [progreso] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const aparicion = splashAnimacion.entrar(entrada);
    aparicion.start();
    return () => aparicion.stop();
  }, [entrada]);

  useEffect(() => {
    if (cargando) return;
    const total = userName ? SPLASH_HABITUAL_MS : SPLASH_PRIMERA_VEZ_MS;
    const carga = animar(progreso, total - SPLASH_FUNDIDO_MS, Easing.linear);
    carga.start(({ finished }) => finished && setListo(true));
    return () => carga.stop();
  }, [cargando, userName, progreso]);

  useEffect(() => {
    marcarArranque(true);
    return () => marcarArranque(false);
  }, []);

  useLayoutEffect(() => {
    forzarTemaClaro(true);
    return () => forzarTemaClaro(false);
  }, []);

  useEffect(() => {
    let activo = true;
    bluetoothApagado().then((valor) => activo && setApagado(valor));
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    if (!(cargadas && listo && bloquear) || verificandoRef.current) return;
    verificandoRef.current = true;
    let activo = true;
    (async () => {
      while (activo) {
        if ((await Biometria.metodo()) === 'ninguno' || (await Biometria.autenticar())) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          marcarDesbloqueada(true);
          break;
        }
        await new Promise((resolver) => setTimeout(resolver, REINTENTO_VERIFICACION_MS));
      }
      verificandoRef.current = false;
    })();
    return () => {
      activo = false;
    };
  }, [cargadas, listo, bloquear]);

  useEffect(() => {
    if (!cargando && cargadas && listo && apagado !== null && !bloquear) {
      Animated.timing(salida, { toValue: 0, duration: SPLASH_FUNDIDO_MS, useNativeDriver: true }).start(() => {
        marcarArranque(false);
        forzarTemaClaro(false);
        router.replace(rutaInicial(userName, deviceMac));
        if (apagado) avisarBluetoothApagado();
      });
    }
  }, [cargando, cargadas, listo, apagado, salida, deviceMac, userName, bloquear]);

  return (
    <Animated.View style={[splashEstilos.pantalla, { opacity: salida }]}>
      <Animated.View style={splashAnimacion.icono(entrada)}>
        <Image
          source={require('../../assets/splash-icon.png')}
          style={{ width: medidas.icono, height: medidas.icono, tintColor: Colors.black }}
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
            <Estrella tamano={medidas.estrella} color={Colors.silver} style={splashEstilos.encima} />
            <Animated.View style={[splashEstilos.encima, splashAnimacion.estrella(progreso, n)]}>
              <Estrella tamano={medidas.estrella} color={Colors.black} />
            </Animated.View>
          </View>
        ))}
      </Animated.View>

      <Animated.View style={[splashEstilos.versionCaja, { bottom: margenes.bottom + 24, opacity: entrada }]}>
        <Text style={splashEstilos.version}>v{APP_VERSION}</Text>
      </Animated.View>
    </Animated.View>
  );
}
