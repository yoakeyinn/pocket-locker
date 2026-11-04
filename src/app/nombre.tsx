import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparece } from '../components/Aparece';
import { Boton } from '../components/Boton';
import { Campo } from '../components/Campo';
import { useBluetooth } from '../services/BluetoothService';
import { LogService } from '../services/StorageService';
import { t } from '../styles/i18n';
import { Text } from '../styles/tipografia/Tipografia';
import tw, { tipografia } from '../styles/styles';

// Se muestra tras el splash mientras no haya nombre de usuario guardado.
export default function NombreScreen() {
  const { deviceMac, guardarNombreUsuario } = useBluetooth();
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);

  const continuar = async () => {
    const limpio = nombre.trim();
    if (!limpio) {
      setError(t('pl_nombre_requerido'));
      return;
    }
    try {
      await guardarNombreUsuario(limpio);
    } catch (e) {
      LogService.error('[Nombre] No se pudo guardar el nombre de usuario', e);
    }
    router.replace(deviceMac ? '/puertas' : '/buscar');
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-beige`} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={tw`flex-1`}>
        <ScrollView
          contentContainerStyle={tw`flex-grow justify-center px-6 py-6`}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <Aparece style={tw`w-full max-w-sm self-center`}>
            <Text style={[tipografia.titulo, tw`text-3xl`]}>{t('pl_nombre_titulo')}</Text>
            <Text style={[tipografia.anotacion, tw`mt-3 mb-8`, { lineHeight: 22 }]}>
              {t('pl_nombre_ayuda', { app: t('pl_app_titulo') })}
            </Text>
            <Campo
              id="nombre-usuario"
              etiqueta={t('pl_nombre_etiqueta')}
              error={error}
              value={nombre}
              onChangeText={(valor) => {
                setNombre(valor);
                setError(null);
              }}
              autoFocus
              autoCapitalize="words"
              maxLength={24}
              returnKeyType="done"
              onSubmitEditing={continuar}
            />
            <View style={tw`mt-8`}>
              <Boton relleno testID="btn-continuar-nombre" texto={t('pl_continuar')} onPress={continuar} />
            </View>
          </Aparece>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
