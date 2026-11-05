import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { TextInput } from '../../styles/tipografia/Tipografia';
import tw, { Colors } from '../../styles/styles';

export const EditorTexto: React.FC<{
  value: string;
  onChangeText: (texto: string) => void;
  onGuardar: () => void;
  onCancelar: () => void;
}> = ({ value, onChangeText, onGuardar, onCancelar }) => (
  <View style={tw`flex-row items-center mt-1`}>
    <TextInput
      testID="editor-texto"
      style={tw`flex-1 bg-silver border border-silver rounded-xl px-3 py-1.5 text-sm font-bold text-black`}
      value={value}
      onChangeText={onChangeText}
      autoFocus
    />
    <TouchableOpacity testID="editor-guardar" onPress={onGuardar} style={tw`ml-2 px-3 py-2 bg-black rounded-xl`}>
      <MaterialIcons name="check" size={18} color={Colors.white} />
    </TouchableOpacity>
    <TouchableOpacity testID="editor-cancelar" onPress={onCancelar} style={tw`ml-1 px-2 py-2 bg-silver rounded-xl`}>
      <MaterialIcons name="close" size={18} color={Colors.gray} />
    </TouchableOpacity>
  </View>
);
