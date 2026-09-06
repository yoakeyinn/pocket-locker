import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { BluetoothProvider } from '../context/BluetoothContext';

/**
 * Disposición Raíz de la Aplicación (Root Layout).
 * Configura los proveedores de contexto globales:
 * - SafeAreaProvider: Manejo de márgenes seguros en pantallas con notch y barras de navegación.
 * - BluetoothProvider: Estado reactivo de conexiones, autenticación y telemetría Bluetooth.
 * - Navegación Stack de Expo Router con transiciones fluidas sin cabeceras nativas visibles.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <BluetoothProvider>
        <StatusBar style="dark" backgroundColor={Colors.beigeBg} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.beigeBg },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="splash" />
          <Stack.Screen name="nombre" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="control" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="resultado" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </BluetoothProvider>
    </SafeAreaProvider>
  );
}
