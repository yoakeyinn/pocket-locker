import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aparece, ENTRADA_LENTA_MS, PASO_ENTRADA_MS } from '../components/Aparece';
import { Boton } from '../components/Boton';
import { Campo } from '../components/Campo';
import { Cargando } from '../components/Cargando';
import { Preferencias } from '../components/Preferencias';
import { useBluetooth } from '../services/BluetoothService';
import { ERROR_BLOQUEO_PENDIENTE, usePreferencias } from '../services/preferencias';
import { sincronizarSimulacion } from '../services/Simulacion';
import { LogService } from '../services/StorageService';
import { ClaveLiteral, t, useIdioma } from '../styles/i18n';
import { Text } from '../styles/tipografia/Tipografia';
import tw, { Colors, tipografia, useTema } from '../styles/styles';

export default function LoginScreen() {
  useIdioma();
  useTema();
  const { deviceMac, guardarNombreUsuario } = useBluetooth();
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<ClaveLiteral | null>(null);
  const [preferenciasAbiertas, setPreferenciasAbiertas] = useState(false);

  const errorBloqueo = usePreferencias((estado) => estado.errorBloqueo);

  const continuar = async () => {
    if (usePreferencias.getState().errorBloqueo === ERROR_BLOQUEO_PENDIENTE) return;
    const limpio = nombre.trim();
    if (!limpio) {
      setError('pl_login_requerido');
      return;
    }
    try {
      await guardarNombreUsuario(limpio);
      await sincronizarSimulacion(limpio);
    } catch (e) {
      LogService.error('[Login] No se pudo guardar el nombre de usuario', e);
    }
    router.replace(deviceMac ? '/puertas' : '/buscar');
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-beige`} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={tw`flex-1`}>
        <ScrollView
          contentContainerStyle={tw`flex-grow justify-center px-6 py-8`}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={tw`w-full max-w-sm self-center`}>
            <Aparece duracion={ENTRADA_LENTA_MS}>
              <View style={tw`flex-row items-center`}>
                <View style={tw`mr-3`}>
                  <Cargando tamano={38} />
                </View>
                <Text style={[tipografia.titulo, tw`flex-1`, { fontSize: 40, lineHeight: 48 }]}>{t('pl_login_titulo')}</Text>
              </View>
            </Aparece>
            <Aparece duracion={ENTRADA_LENTA_MS} retraso={PASO_ENTRADA_MS} style={tw`mt-3`}>
              <Text style={[tipografia.anotacion, { lineHeight: 22 }]}>
                {t('pl_login_descripcion', { app: t('pl_app_titulo') })}
              </Text>
            </Aparece>

            <Aparece duracion={ENTRADA_LENTA_MS} retraso={PASO_ENTRADA_MS * 2}>
            <Campo
              id="nombre-usuario"
              clase="mt-10"
              etiqueta={t('pl_login_etiqueta')}
              error={error ? t(error) : null}
              value={nombre}
              onChangeText={(valor) => {
                setNombre(valor);
                setError(null);
              }}
              autoCapitalize="words"
              maxLength={24}
              returnKeyType="done"
              onSubmitEditing={continuar}
            />
            </Aparece>

            <Aparece duracion={ENTRADA_LENTA_MS} retraso={PASO_ENTRADA_MS * 3}>
            <TouchableOpacity
              testID="btn-preferencias"
              accessibilityRole="button"
              accessibilityState={{ expanded: preferenciasAbiertas }}
              onPress={() => setPreferenciasAbiertas((abiertas) => !abiertas)}
              activeOpacity={0.7}
              style={tw`flex-row items-center justify-between mt-10 mb-2 py-1`}
            >
              <Text style={[tipografia.anotacion, tw`text-xs uppercase`]}>{t('pl_login_preferencias')}</Text>
              <Feather name={preferenciasAbiertas ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.black} />
            </TouchableOpacity>
            {preferenciasAbiertas && (
              <Aparece duracion={ENTRADA_LENTA_MS}>
                <Preferencias errorFuera />
              </Aparece>
            )}
            </Aparece>

            <Aparece duracion={ENTRADA_LENTA_MS} retraso={PASO_ENTRADA_MS * 4} style={tw`mt-10`}>
              <Boton
                relleno
                testID="btn-continuar-login"
                texto={t('pl_continuar')}
                deshabilitado={errorBloqueo === ERROR_BLOQUEO_PENDIENTE}
                onPress={continuar}
              />
              {errorBloqueo ? (
                <Text testID="error-biometria" style={[tipografia.error, tw`text-center mt-3`]}>
                  {t(errorBloqueo)}
                </Text>
              ) : null}
            </Aparece>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
