import React from 'react';
import { View } from 'react-native';
import { reportarErrorFatal } from '../services/ErrorService';
import tw from '../styles/styles';

export class LimiteDeErrores extends React.Component<{ children: React.ReactNode }, { hayError: boolean }> {
  state = { hayError: false };

  static getDerivedStateFromError() {
    return { hayError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportarErrorFatal(error, `Error al dibujar la pantalla. Componentes:${info.componentStack}`);
  }

  render() {
    return this.state.hayError ? <View style={tw`flex-1 bg-beige`} /> : this.props.children;
  }
}
