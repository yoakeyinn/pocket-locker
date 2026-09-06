import React from 'react';
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
import tw from '../../styles/tailwind';

/**
 * Propiedades del componente ModalRenombrar.
 */
interface ModalRenombrarProps {
  /** Determina si el diálogo modal se encuentra abierto */
  visible: boolean;
  /** Título principal del modal (ej. "Renombrar Dispositivo" o "Editar Nombre") */
  titulo: string;
  /** Subtítulo o texto de ayuda explicativo */
  subtitulo: string;
  /** Etiqueta superior que acompaña al campo de texto */
  label: string;
  /** Valor actual del campo de texto */
  valor: string;
  /** Callback para actualizar el estado del valor conforme el usuario escribe */
  setValor: (val: string) => void;
  /** Indica si la operación asíncrona de guardado está en ejecución */
  guardando: boolean;
  /** Callback para cancelar y cerrar el modal */
  onCancel: () => void;
  /** Callback para confirmar y guardar el nuevo valor */
  onConfirm: () => void;
}

/**
 * Modal genérico y reutilizable para edición de cadenas de texto breves (nombres).
 * Proporciona `KeyboardAvoidingView` para evitar solapamientos con el teclado virtual del sistema
 * e indicador de progreso interactivo en el botón de confirmación.
 * Estilizado íntegramente con clases utilitarias de Tailwind CSS.
 */
export const ModalRenombrar: React.FC<ModalRenombrarProps> = ({
  visible,
  titulo,
  subtitulo,
  label,
  valor,
  setValor,
  guardando,
  onCancel,
  onConfirm,
}) => {
  return (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onCancel} statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={tw`flex-1 bg-black/60 justify-center items-center px-4`}
      >
        <View style={tw`w-full max-w-sm bg-beige-card rounded-3xl p-6 shadow-2xl border border-stone-100`}>
          <Text style={tw`text-lg font-bold text-azul-oscuro mb-1.5`}>{titulo}</Text>
          <Text style={tw`text-xs text-texto-secundario mb-4 leading-4`}>{subtitulo}</Text>

          <Text style={tw`text-xs font-bold text-texto-secundario uppercase mb-1.5 tracking-wider`}>
            {label}
          </Text>
          <TextInput
            style={tw`border border-stone-300 rounded-xl px-4 py-2.5 text-base text-azul-oscuro bg-stone-50 mb-5`}
            value={valor}
            onChangeText={setValor}
            maxLength={24}
            autoFocus
          />

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

export default ModalRenombrar;
