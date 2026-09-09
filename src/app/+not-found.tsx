import React from 'react';
import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';
import tw from '../styles';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'No encontrado' }} />
      <View style={tw`flex-1 items-center justify-center p-5 bg-beige-bg`}>
        <Text style={tw`text-lg font-bold text-azul-oscuro`}>Pantalla no encontrada</Text>
        <Link href="/" style={tw`mt-4 py-3`}>
          <Text style={tw`text-sm font-semibold text-azul-primario`}>Volver al inicio</Text>
        </Link>
      </View>
    </>
  );
}
