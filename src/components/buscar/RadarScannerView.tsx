import React, { useEffect, useState } from 'react';
import { View, Animated, Easing, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparece, ENTRADA_LENTA_MS, PASO_ENTRADA_MS } from '../Aparece';
import { Boton } from '../Boton';
import { Estrella } from '../Estrella';
import { Text } from '../../styles/tipografia/Tipografia';
import { t } from '../../styles/i18n';
import tw, { Colors, cicloPulso, tipografia } from '../../styles/styles';

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

  const [giros] = useState(() => ORBITAS.map(() => new Animated.Value(0)));
  const [estrellas] = useState(() => new Animated.Value(OPACIDAD_ORBITA));
  const [objetivo] = useState(() => new Animated.Value(0));
  const [pingEscala] = useState(() => new Animated.Value(1));
  const [pingOpacidad] = useState(() => new Animated.Value(0.8));

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
        {}
        <Aparece
          duracion={ENTRADA_LENTA_MS}
          style={{ width: tamanoTitulo * ANCHO_TITULO_EM, maxWidth: '90%', marginTop: Math.round(height * 0.07) }}
        >
          <Text numberOfLines={2} adjustsFontSizeToFit style={estiloTitulo}>
            {t('pl_buscando', { app: t('pl_app_titulo') })}
          </Text>
        </Aparece>

        <Aparece duracion={ENTRADA_LENTA_MS} retraso={PASO_ENTRADA_MS} style={tw`my-auto`}>
        <View style={[tw`items-center justify-center`, { width: lado, height: lado }]}>
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
                    <Estrella tamano={ESTRELLA_RADAR} color={Colors.silver} />
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
                <Estrella tamano={ESTRELLA_RADAR} color={Colors.black} contorno />
              </Animated.View>
              <Estrella tamano={ESTRELLA_RADAR} color={Colors.black} />
            </Animated.View>
          )}
        </View>
        </Aparece>

        <Aparece duracion={ENTRADA_LENTA_MS} retraso={PASO_ENTRADA_MS * 2} style={tw`w-full items-center mb-8`}>
          <Boton testID="btn-ir-manual" texto={t('pl_ver_dispositivos')} onPress={onCambiarAManual} style={tw`px-7`} />
        </Aparece>
      </View>
    </SafeAreaView>
  );
};
