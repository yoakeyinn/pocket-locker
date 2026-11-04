import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors } from '../styles/styles';
import { BluetoothProvider } from '../services/BluetoothService';
import { LimiteDeErrores } from '../components/LimiteDeErrores';
import { ModalHost } from '../components/Modal';
import { instalarCapturaDeErrores } from '../services/ErrorService';
import { modoSimulacion } from '../services/comun';
import { LogService } from '../services/StorageService';
import { activarFuentes } from '../styles/tipografia/fonts';
import { ARCHIVOS_FUENTES } from '../styles/tipografia/fuentesArchivos';

instalarCapturaDeErrores();

if (modoSimulacion()) {
  require('../../tests/simulacion/bluetooth').instalarSimulacion(modoSimulacion());
}

function Aplicacion() {
  const [fuentesCargadas, errorFuentes] = useFonts(ARCHIVOS_FUENTES);

  useEffect(() => {
    if (errorFuentes) LogService.error('[Fuentes] No se pudieron cargar las fuentes: se usa la del sistema', errorFuentes);
  }, [errorFuentes]);

  activarFuentes(fuentesCargadas && !errorFuentes);
  if (!fuentesCargadas && !errorFuentes) {
    return <View style={{ flex: 1, backgroundColor: Colors.beige }} />;
  }

  return (
    <BluetoothProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.beige },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="nombre" />
        <Stack.Screen name="buscar" />
        <Stack.Screen name="puertas" />
        <Stack.Screen name="ajustes" />
      </Stack>
    </BluetoothProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LimiteDeErrores>
        <Aplicacion />
      </LimiteDeErrores>
      <ModalHost />
    </SafeAreaProvider>
  );
}
