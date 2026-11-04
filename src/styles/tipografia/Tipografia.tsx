import React from 'react';
import { Text as RNText, TextInput as RNTextInput } from 'react-native';
import { estiloConFuente } from './fonts';

export const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} style={estiloConFuente(props.style)} />
);

export const TextInput = (props: React.ComponentProps<typeof RNTextInput>) => (
  <RNTextInput {...props} style={estiloConFuente(props.style)} />
);
