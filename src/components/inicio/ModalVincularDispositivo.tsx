import React from 'react';
import {
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import tw from '../../styles/tailwind';

/**
 * Propiedades del componente ModalVincularDispositivo.
 */
interface ModalVincularDispositivoProps {
  /** Determina si el diálogo modal se encuentra visible en pantalla */
  visible: boolean;
  /** Indica si la operación de vinculación y handshake criptográfico está en progreso */
  guardando: boolean;
  /** Nombre del usuario activo actual para asociar al dispositivo */
  userName: string | null;
  /** Nombre personalizado introducido para el dispositivo */
  nombrePersonalizado: string;
  /** Setter para actualizar el nombre personalizado */
  setNombrePersonalizado: (val: string) => void;
  /** PIN de seguridad introducido para el dispositivo (ej. 2415 o hash asignado) */
  pinSeguridad: string;
  /** Setter para actualizar el PIN de seguridad */
  setPinSeguridad: (val: string) => void;
  /** Callback invocado al pulsar el botón Cancelar o cerrar el modal */
  onCancel: () => void;
  /** Callback invocado al confirmar la vinculación */
  onConfirm: () => void;
}

/**
 * Modal interactivo para vincular un Pocket Locker nuevo.
 * Solicita el nombre personalizado deseado y el PIN de seguridad del dispositivo
 * (por ejemplo 2415 para administradores o código temporal para invitados).
 * Incluye soporte nativo para teclado flotante (`KeyboardAvoidingView`) y estilos Tailwind CSS.
 */
export const ModalVincularDispositivo: React.FC<ModalVincularDispositivoProps> = ({
  visible,
  guardando,
  userName,
  nombrePersonalizado,
  setNombrePersonalizado,
  pinSeguridad,
  setPinSeguridad,
  onCancel,
  onConfirm,
}) => {
  return (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onCancel} statusBarTranslucent>
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
              Introduce el nombre y el PIN de seguridad para vincular este dispositivo a tu perfil (
              {userName || 'Usuario'}):
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
              keyboardType="default"
              autoCapitalize="characters"
              maxLength={16}
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
};

export default ModalVincularDispositivo;
