import React, { useState, useEffect } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useBluetooth } from '../context/BluetoothContext';
import tw from '../styles/tailwind';

/**
 * Pantalla de Identificación de Usuario (Nombre).
 * Se presenta inmediatamente tras el Splash Screen si el usuario aún no tiene nombre guardado.
 * Disposición optimizada en la mitad superior con soporte nativo de desplazamiento y teclado
 * para garantizar visibilidad completa y cómoda en cualquier tamaño de pantalla.
 */
export default function NombreScreen() {
  const {
    userName,
    isDemoMode,
    activarModoDemo,
    desactivarModoDemo,
    guardarNombreUsuario,
  } = useBluetooth();

  const [nombre, setNombre] = useState<string>('');

  useEffect(() => {
    if (userName && userName !== 'DEMO') {
      setNombre(userName);
    }
  }, [userName]);

  const handleContinuar = async () => {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      Alert.alert('Nombre requerido', 'Por favor, introduce tu nombre para continuar.');
      return;
    }

    if (nombreLimpio.toUpperCase() === 'DEMO') {
      await activarModoDemo();
      router.replace('/(tabs)');
      return;
    }

    if (isDemoMode) {
      await desactivarModoDemo();
    }
    await guardarNombreUsuario(nombreLimpio);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-beige-bg`} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={tw`flex-1`}
      >
        <ScrollView
          contentContainerStyle={tw`flex-grow justify-start pt-10 px-6 pb-6`}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View
            style={tw`bg-beige-card rounded-3xl p-6 w-full shadow-lg border border-stone-200/60`}
          >
            <View style={tw`w-18 h-18 rounded-full bg-azul-primario/10 items-center justify-center self-center mb-4`}>
              <MaterialIcons name="person" size={44} color="#2C5F8A" />
            </View>

            <Text style={tw`text-2xl font-bold text-azul-oscuro text-center mb-2`}>
              ¿Cómo te llamas?
            </Text>
            <Text style={tw`text-sm text-texto-secundario text-center mb-6 leading-5 px-2`}>
              Introduce tu nombre o apodo para identificarte en tu Pocket Locker:
            </Text>

            <Text style={tw`text-xs font-bold text-texto-secundario uppercase mb-2 tracking-wider`}>
              Nombre de usuario
            </Text>
            <TextInput
              testID="input-nombre-usuario"
              style={tw`border border-stone-300 rounded-xl px-4 py-3 text-base text-azul-oscuro bg-stone-50 mb-6`}
              value={nombre}
              onChangeText={setNombre}
              autoFocus
              autoCapitalize="words"
              maxLength={24}
              returnKeyType="done"
              onSubmitEditing={handleContinuar}
            />

            <TouchableOpacity
              testID="btn-continuar-nombre"
              style={tw`flex-row items-center justify-center py-3.5 rounded-xl bg-azul-primario shadow-md`}
              onPress={handleContinuar}
              activeOpacity={0.85}
            >
              <Text style={tw`text-white font-bold text-base mr-2`}>Continuar</Text>
              <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
