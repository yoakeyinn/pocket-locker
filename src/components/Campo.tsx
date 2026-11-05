import React from 'react';
import { TextInputProps, View } from 'react-native';
import { Text, TextInput } from '../styles/tipografia/Tipografia';
import tw, { tipografia } from '../styles/styles';

const ETIQUETA = 'text-xs font-light text-gray uppercase mb-1.5 tracking-widest';
const CAMPO = 'border rounded-lg px-4 py-2.5 text-base font-light text-black bg-white';

export interface CampoProps extends TextInputProps {
  id: string;
  etiqueta: string;
  error?: string | null;
  clase?: string;
}

export const Campo: React.FC<CampoProps> = ({ id, etiqueta, error, clase = '', ...resto }) => (
  <View style={tw`${clase}`}>
    <Text style={tw`${ETIQUETA}`}>{etiqueta}</Text>
    <TextInput testID={`input-${id}`} style={tw`${CAMPO} ${error ? 'border-red' : 'border-silver'}`} {...resto} />
    {error ? (
      <Text testID={`error-${id}`} style={[tipografia.error, tw`mt-1.5`]}>
        {error}
      </Text>
    ) : null}
  </View>
);
