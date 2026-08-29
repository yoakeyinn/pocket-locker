import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

/**
 * Disposición de Pestañas Inferiores (Tabs Navigation Layout).
 * Estructura las dos vistas primarias de la aplicación:
 * 1. Inicio: Escaneo y acceso al panel de control del locker.
 * 2. Ajustes: Configuración de nombres, PIN de seguridad y modo de demostración.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.azulPrimario,
        tabBarInactiveTintColor: Colors.textoSecundario,
        tabBarStyle: {
          backgroundColor: Colors.beigeCard,
          borderTopColor: '#E5E5E5',
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        sceneStyle: { backgroundColor: Colors.beigeBg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
