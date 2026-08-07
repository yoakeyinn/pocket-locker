import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { BluetoothProvider } from '../context/BluetoothContext';

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
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="control" />
          <Stack.Screen name="resultado" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </BluetoothProvider>
    </SafeAreaProvider>
  );
}
