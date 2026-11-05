import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal as ModalNativo,
  Platform,
  ScrollView,
  Share,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { create } from 'zustand';
import { Boton } from './Boton';
import { useArranque } from '../services/arranque';
import { t } from '../styles/i18n';
import { Text } from '../styles/tipografia/Tipografia';
import tw, { Colors, tipografia, useTema } from '../styles/styles';
import { useMargenesSeguros } from '../styles/margenes';

export interface BotonModal {
  texto: string;
  onPress: () => void;
  deshabilitado?: boolean;
  rojo?: boolean;
}

export interface ModalProps {
  visible: boolean;
  titulo: string;
  mensaje?: string;
  children?: React.ReactNode;
  tituloEnRojo?: boolean;
  izquierdo?: BotonModal;
  derecho?: BotonModal;
  onCerrar?: () => void;
}

export const ANIMACION_MODAL = { retrasoMs: 120, duracionMs: 700, subidaPx: 10, escalaInicial: 0.97 };

export const Modal: React.FC<ModalProps> = ({
  visible,
  titulo,
  mensaje,
  children,
  tituloEnRojo,
  izquierdo,
  derecho,
  onCerrar,
}) => {
  const [entrada] = useState(() => new Animated.Value(0));
  const margenes = useMargenesSeguros();

  useEffect(() => {
    if (!visible) return;
    entrada.setValue(0);
    const aparicion = Animated.sequence([
      Animated.delay(ANIMACION_MODAL.retrasoMs),
      Animated.timing(entrada, {
        toValue: 1,
        duration: ANIMACION_MODAL.duracionMs,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }),
    ]);
    aparicion.start();
    return () => aparicion.stop();
  }, [visible, entrada]);

  return (
    <ModalNativo animationType="fade" transparent visible={visible} onRequestClose={onCerrar} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[tw`flex-1`, { backgroundColor: 'rgba(0, 0, 0, 0.6)' }]}>
        <ScrollView
          style={tw`w-full`}
          contentContainerStyle={[
            tw`flex-grow justify-center items-center px-6`,
            { paddingTop: margenes.top + 24, paddingBottom: margenes.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <Animated.View
            style={[
              tw`w-full max-w-sm bg-beige rounded-lg border border-silver p-6`,
              {
                opacity: entrada,
                transform: [
                  { translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [ANIMACION_MODAL.subidaPx, 0] }) },
                  { scale: entrada.interpolate({ inputRange: [0, 1], outputRange: [ANIMACION_MODAL.escalaInicial, 1] }) },
                ],
              },
            ]}
          >
            <Text style={[tipografia.titulo, tw`text-2xl`, tituloEnRojo && tw`text-red`]}>{titulo}</Text>
            {mensaje ? <Text style={tw`text-sm font-light text-gray leading-5 mt-3`}>{mensaje}</Text> : null}
            {children ? <View style={tw`mt-5`}>{children}</View> : null}

            <View style={tw`flex-row items-center mt-7`}>
              {izquierdo && <Boton {...izquierdo} testID="modal-boton-izquierdo" />}
              <View style={tw`flex-1`} />
              {derecho && <Boton {...derecho} relleno testID="modal-boton-derecho" />}
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ModalNativo>
  );
};

export interface BotonAlerta {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
  rojo?: boolean;
}

interface ModalPendiente {
  titulo: string;
  mensaje?: string;
  botones: BotonAlerta[];
  registro?: string;
}

const useModalStore = create<{ modal: ModalPendiente | null }>(() => ({ modal: null }));

export function mostrarModal(titulo: string, mensaje?: string, botones?: BotonAlerta[]): void {
  if (useModalStore.getState().modal?.registro) return;
  useModalStore.setState({
    modal: { titulo, mensaje, botones: botones?.length ? botones : [{ text: t('pl_aceptar') }] },
  });
}

const cerrarApp = () => {
  require('../services/Salir').cerrarAplicacion();
};

export function mostrarModalError(titulo: string, mensaje: string, registro: string): void {
  if (useModalStore.getState().modal?.registro) return;
  useModalStore.setState({
    modal: { titulo, mensaje, registro, botones: [{ text: t('pl_cerrar'), onPress: cerrarApp }] },
  });
}

const PanelRegistro: React.FC<{ texto: string }> = ({ texto }) => {
  const [copiado, setCopiado] = useState(false);
  const [aparicion] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animacion = Animated.timing(aparicion, {
      toValue: 1,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animacion.start();
    return () => animacion.stop();
  }, [aparicion]);

  useEffect(() => {
    if (!copiado) return;
    const temporizador = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(temporizador);
  }, [copiado]);

  const copiar = async () => {
    try {
      await require('expo-clipboard').setStringAsync(texto);
      setCopiado(true);
    } catch {
      Share.share({ message: texto }).catch(() => {});
    }
  };

  return (
    <Animated.View
      testID="modal-registro"
      style={[
        tw`border border-silver rounded-lg bg-white`,
        { opacity: aparicion, transform: [{ translateY: aparicion.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
      ]}
    >
      <View style={tw`flex-row items-center justify-between px-3 py-2 border-b border-silver`}>
        <Text style={[tipografia.anotacion, tw`text-xs`]}>{t('pl_registro_titulo')}</Text>
        <TouchableOpacity
          testID="modal-copiar"
          onPress={copiar}
          accessibilityLabel={t('pl_copiar_registro')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={tw`flex-row items-center`}
        >
          {copiado && <Text style={[tipografia.anotacion, tw`text-xs mr-1.5`]}>{t('pl_copiado')}</Text>}
          <MaterialIcons name={copiado ? 'check' : 'content-copy'} size={18} color={Colors.black} />
        </TouchableOpacity>
      </View>
      <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }} contentContainerStyle={tw`p-3`}>
        <Text selectable style={tw`text-xs font-mono text-black leading-4`}>
          {texto}
        </Text>
      </ScrollView>
    </Animated.View>
  );
};

export const ModalHost: React.FC = () => {
  const modal = useModalStore((estado) => estado.modal);
  const arrancando = useArranque((estado) => estado.enCurso);
  useTema();
  const [registroVisible, setRegistroVisible] = useState(false);
  const ultimo = useRef(modal);
  if (modal) ultimo.current = modal;
  const contenido = ultimo.current;

  useEffect(() => {
    setRegistroVisible(false);
  }, [modal]);

  if (!contenido) return null;

  const { botones, registro } = contenido;
  const cancelar = botones.find((b) => b.style === 'cancel');
  const pulsar = (boton?: BotonAlerta) => () => {
    useModalStore.setState({ modal: null });
    boton?.onPress?.();
  };
  const aBoton = (boton: BotonAlerta): BotonModal => ({
    texto: boton.text,
    onPress: pulsar(boton),
    rojo: boton.rojo,
  });
  const ultimoBoton = botones[botones.length - 1];

  const izquierdo: BotonModal | undefined = registro
    ? {
        texto: registroVisible ? t('pl_ocultar_logs') : t('pl_ver_logs'),
        onPress: () => setRegistroVisible((visible) => !visible),
      }
    : botones.length > 1
      ? aBoton(botones[0])
      : undefined;

  return (
    <Modal
      visible={!!modal && (!arrancando || !!registro)}
      titulo={contenido.titulo}
      mensaje={contenido.mensaje}
      tituloEnRojo={!!registro}
      izquierdo={izquierdo}
      derecho={aBoton(ultimoBoton)}
      onCerrar={pulsar(registro ? ultimoBoton : cancelar)}
    >
      {registro && registroVisible ? <PanelRegistro texto={registro} /> : null}
    </Modal>
  );
};
