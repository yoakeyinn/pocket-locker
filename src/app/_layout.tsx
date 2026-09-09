import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors } from '../styles';
import { BluetoothProvider } from '../services/BluetoothService';

/**
 * Disposición Raíz de la Aplicación (Root Layout).
 * Configura los proveedores globales y el stack plano de pantallas de Expo Router:
 * - SafeAreaProvider: Manejo de márgenes seguros en pantallas con notch.
 * - BluetoothProvider: Estado reactivo de conexiones, autenticación y telemetría Bluetooth.
 * - Navegación Stack con transiciones fluidas y fondos consistentes.
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
          <Stack.Screen name="inicio" />
          <Stack.Screen name="control" />
          <Stack.Screen name="ajustes" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </BluetoothProvider>
    </SafeAreaProvider>
  );
}
