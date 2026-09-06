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
  Switch,
  ActivityIndicator,
} from 'react-native';
import { UsuarioAdmin } from '../../context/BluetoothContext';
import tw from '../../styles/tailwind';

/**
 * Propiedades del componente ModalEditarUsuario.
 */
interface ModalEditarUsuarioProps {
  /** Determina si el diálogo modal se encuentra abierto */
  visible: boolean;
  /** Datos del usuario actualmente seleccionado para editar, o null si está cerrado */
  usuario: UsuarioAdmin | null;
  /** Días de validez configurados (en formato texto para el campo de entrada) */
  editDias: string;
  /** Setter para actualizar el valor de días de validez */
  setEditDias: (val: string) => void;
  /** Estado del permiso para accionar el relé peatonal */
  editPeatonal: boolean;
  /** Setter para actualizar el permiso peatonal */
  setEditPeatonal: (val: boolean) => void;
  /** Estado del permiso para accionar el relé del garaje */
  editGaraje: boolean;
  /** Setter para actualizar el permiso del garaje */
  setEditGaraje: (val: boolean) => void;
  /** Indica si la petición BLE al firmware del ESP32 está en proceso */
  guardando: boolean;
  /** Callback para cancelar la edición y cerrar el modal */
  onCancel: () => void;
  /** Callback para confirmar y transmitir los nuevos permisos al ESP32 */
  onConfirm: () => void;
}

/**
 * Modal de administración avanzada para configurar permisos de acceso y temporalidad.
 * Permite definir los días de vigencia (0 = sin caducidad) e individualizar los accesos concedidos
 * (relé peatonal y/o portón de garaje) mediante interruptores deslizantes nativos (`Switch`).
 * Estilizado íntegramente con clases utilitarias de Tailwind CSS.
 */
export const ModalEditarUsuario: React.FC<ModalEditarUsuarioProps> = ({
  visible,
  usuario,
  editDias,
  setEditDias,
  editPeatonal,
  setEditPeatonal,
  editGaraje,
  setEditGaraje,
  guardando,
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
            <Text style={tw`text-lg font-bold text-azul-oscuro mb-1`}>Editar Permisos y Validez</Text>
            <Text style={tw`text-xs text-texto-secundario mb-5 leading-4`}>
              Modificando usuario:{' '}
              <Text style={tw`font-bold text-azul-oscuro`}>
                {usuario?.nombre} ({usuario?.mac})
              </Text>
            </Text>

            {/* Días */}
            <Text style={tw`text-xs font-bold text-texto-secundario uppercase mb-1.5 tracking-wider`}>
              Días de validez (0 = ilimitado)
            </Text>
            <TextInput
              style={tw`border border-stone-300 rounded-xl px-4 py-2.5 text-base text-azul-oscuro bg-stone-50 mb-5`}
              value={editDias}
              onChangeText={setEditDias}
              keyboardType="number-pad"
              maxLength={2}
            />

            {/* Switch Peatonal */}
            <View style={tw`flex-row items-center justify-between py-2.5 mb-2`}>
              <View style={tw`flex-1 mr-2`}>
                <Text style={tw`text-sm font-bold text-azul-oscuro`}>Acceso Puerta Peatonal</Text>
                <Text style={tw`text-xs text-texto-secundario mt-0.5`}>
                  Permite activar el relé peatonal
                </Text>
              </View>
              <Switch
                value={editPeatonal}
                onValueChange={setEditPeatonal}
                trackColor={{ false: '#D1D5DB', true: '#2C5F8A' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Switch Garaje */}
            <View style={tw`flex-row items-center justify-between py-2.5 mb-6`}>
              <View style={tw`flex-1 mr-2`}>
                <Text style={tw`text-sm font-bold text-azul-oscuro`}>Acceso Portón de Garaje</Text>
                <Text style={tw`text-xs text-texto-secundario mt-0.5`}>
                  Permite activar el relé del garaje
                </Text>
              </View>
              <Switch
                value={editGaraje}
                onValueChange={setEditGaraje}
                trackColor={{ false: '#D1D5DB', true: '#2C5F8A' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Botones */}
            <View style={tw`flex-row justify-end gap-3`}>
              <TouchableOpacity
                style={tw`px-4 py-2.5 rounded-xl bg-stone-100`}
                onPress={onCancel}
                disabled={guardando}
              >
                <Text style={tw`text-sm font-semibold text-texto-secundario`}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={tw`px-5 py-2.5 rounded-xl bg-azul-primario min-w-24 items-center justify-center`}
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
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default ModalEditarUsuario;
