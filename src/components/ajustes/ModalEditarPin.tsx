import React, { useState } from 'react';
import {
  Modal,
  KeyboardAvoidingView,
  Platform,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import tw from '../../styles/tailwind';

/**
 * Propiedades del componente ModalEditarPin.
 */
interface ModalEditarPinProps {
  /** Determina si el diálogo modal se encuentra abierto */
  visible: boolean;
  /** Valor actual del PIN de seguridad introducido */
  pin: string;
  /** Callback para actualizar el estado del PIN en tiempo real */
  setPin: (val: string) => void;
  /** Indica si el guardado en SecureStore está en curso */
  guardando: boolean;
  /** Callback para cancelar y descartar los cambios */
  onCancel: () => void;
  /** Callback para confirmar y almacenar el nuevo PIN */
  onConfirm: () => void;
}

/**
 * Modal interactivo para modificar el PIN de seguridad del dispositivo.
 * Permite ingresar códigos numéricos o alfanuméricos en mayúsculas, persistidos
 * de forma cifrada mediante `SecureStore`.
 * Estilizado íntegramente con clases utilitarias de Tailwind CSS.
 */
export const ModalEditarPin: React.FC<ModalEditarPinProps> = ({
  visible,
  pin,
  setPin,
  guardando,
  onCancel,
  onConfirm,
}) => {
  const [mostrarPin, setMostrarPin] = useState(true);

  return (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onCancel} statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={tw`flex-1 bg-black/60 justify-center items-center px-4`}
      >
        <View style={tw`w-full max-w-sm bg-beige-card rounded-3xl p-6 shadow-2xl border border-stone-100`}>
          <Text style={tw`text-lg font-bold text-azul-oscuro mb-1.5`}>Modificar PIN</Text>
          <Text style={tw`text-xs text-texto-secundario mb-4 leading-4`}>
            Introduce el nuevo PIN seguro de 4 dígitos o código alfanumérico asignado por el administrador:
          </Text>

          <Text style={tw`text-xs font-bold text-texto-secundario uppercase mb-1.5 tracking-wider`}>
            PIN de Seguridad
          </Text>
          <View style={tw`flex-row items-center border border-stone-300 rounded-xl bg-stone-50 mb-5 px-3`}>
            <TextInput
              style={tw`flex-1 py-2.5 text-base text-azul-oscuro font-mono`}
              value={pin}
              onChangeText={setPin}
              secureTextEntry={!mostrarPin}
              autoCapitalize="characters"
              maxLength={16}
              autoFocus
            />
            <TouchableOpacity
              onPress={() => setMostrarPin((prev) => !prev)}
              style={tw`p-1.5`}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons
                name={mostrarPin ? 'visibility' : 'visibility-off'}
                size={20}
                color="#6B6B6B"
              />
            </TouchableOpacity>
          </View>

          <View style={tw`flex-row justify-end gap-3`}>
            <TouchableOpacity
              style={tw`px-4 py-2.5 rounded-xl bg-stone-100`}
              onPress={onCancel}
              disabled={guardando}
            >
              <Text style={tw`text-sm font-semibold text-texto-secundario`}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={tw`px-5 py-2.5 rounded-xl bg-azul-primario min-w-20 items-center justify-center`}
              onPress={onConfirm}
              disabled={guardando}
            >
              {guardando ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={tw`text-sm font-bold text-white`}>Guardar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default ModalEditarPin;
