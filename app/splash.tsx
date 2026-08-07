import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useBluetooth } from '../context/BluetoothContext';

export default function SplashScreen() {
  const { cargando } = useBluetooth();
  const opacity = useRef(new Animated.Value(1)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 10000, // 10 seconds
      useNativeDriver: false,
    }).start(() => {
      setMinTimeElapsed(true);
    });
  }, [progress]);

  useEffect(() => {
    if (!cargando && minTimeElapsed) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => {
        router.replace('/(tabs)');
      });
    }
  }, [cargando, minTimeElapsed, opacity]);

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <MaterialIcons name="lock" size={80} color={Colors.azulPrimario} />
      <Text style={styles.title}>POCKET LOCKER</Text>
      <Text style={styles.subtitle}>Control de acceso</Text>
      
      <View style={styles.progressBarContainer}>
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.beigeBg,
  },
  title: {
    color: Colors.azulOscuro,
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    letterSpacing: 2,
  },
  subtitle: {
    color: Colors.textoSecundario,
    fontSize: 14,
    marginTop: 8,
  },
  progressBarContainer: {
    width: '65%',
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 3,
    marginTop: 48,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.azulPrimario,
    borderRadius: 3,
  },
});
