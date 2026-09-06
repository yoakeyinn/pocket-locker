import React, { createContext, useContext, useEffect, useRef } from 'react';
import { AppState, AppStateStatus, NativeModules } from 'react-native';
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import StorageService from '../services/StorageService';
import BluetoothService from '../services/BluetoothService';
import LogService from '../services/LogService';
import { usePocketStore } from '../store/usePocketStore';
import { UsuarioAdmin, BluetoothStatus, PocketStore } from '../store/types';

export { UsuarioAdmin, BluetoothStatus };
export { usePocketStore };

/**
 * Interfaz pública expuesta por el contexto Bluetooth (retrocompatible).
 */
export type BluetoothContextType = PocketStore;

const BluetoothContext = createContext<BluetoothContextType | undefined>(undefined);

/**
 * Proveedor principal del ciclo de vida y adaptadores nativos.
 * Conecta el hardware y el sistema operativo al Store global de Zustand.
 */
export function BluetoothProvider({ children }: { children: React.ReactNode }) {
  const store = usePocketStore();
  const appStateDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Inicialización del store al arrancar
    usePocketStore.getState().inicializar();

    // Escuchar desconexión física reportada por el servicio
    const unregDesconexion = BluetoothService.registrarOnDesconexion(() => {
      LogService.warn('Desconexión física reportada por el servicio Bluetooth.');
      usePocketStore.getState().setStatus('disconnected');
    });

    // Escuchar telemetría de datos
    const unregDatos = BluetoothService.registrarOnDatosRecibidos((linea) => {
      LogService.info(`[TELEMETRÍA RX] Respuesta del Locker: ${linea}`);
    });

    // Escuchar ciclo de vida de la aplicación con debounce anti-rebote
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (appStateDebounceTimer.current) {
        clearTimeout(appStateDebounceTimer.current);
      }

      if (nextAppState === 'active') {
        if (usePocketStore.getState().isDemoMode) return;
        appStateDebounceTimer.current = setTimeout(async () => {
          LogService.info('App pasó a primer plano. Verificando estado del enlace...');
          const currentStore = usePocketStore.getState();
          const mac = currentStore.deviceMac || (await StorageService.getDeviceMac());
          if (mac) {
            try {
              const estaConectado = await BluetoothService.estaConectado();
              if (estaConectado) {
                currentStore.setStatus('connected');
                currentStore.sincronizarConLocker().catch(() => {});
              }
            } catch (e) {
              LogService.warn('Aviso al verificar enlace en primer plano', e);
            }
          }
        }, 300);
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        LogService.info('App pasó a segundo plano o inactiva. Liberando enlace Bluetooth para otros usuarios...');
        if (!usePocketStore.getState().isDemoMode) {
          try {
            await BluetoothService.desconectar();
            usePocketStore.getState().setStatus('disconnected');
          } catch (e) {
            LogService.warn('Aviso al desconectar en segundo plano', e);
          }
        }
      }
    };

    const appStateSub = AppState.addEventListener('change', handleAppStateChange);

    // Escuchar cambios de estado del adaptador Bluetooth en el sistema (on/off)
    let onEnabledSub: any = null;
    let onDisabledSub: any = null;

    if (NativeModules.RNBluetoothClassic && (RNBluetoothClassic as any)._nativeModule) {
      onEnabledSub = RNBluetoothClassic.onBluetoothEnabled(async () => {
        if (usePocketStore.getState().isDemoMode) return;
        LogService.info('Adaptador Bluetooth activado en el sistema operativo.');
        const currentStore = usePocketStore.getState();
        const mac = currentStore.deviceMac || (await StorageService.getDeviceMac());
        const type = currentStore.deviceType || (await StorageService.getDeviceType());
        if (mac) {
          currentStore.setStatus('disconnected');
          try {
            await currentStore.conectarDispositivo(mac, type);
          } catch {
            // Ignorar fallos de auto-conexión
          }
        } else {
          if (currentStore.status !== 'unpaired') {
            currentStore.setStatus('unpaired');
          }
        }
      });

      onDisabledSub = RNBluetoothClassic.onBluetoothDisabled(() => {
        LogService.info('Adaptador Bluetooth desactivado en el sistema operativo.');
        usePocketStore.getState().setStatus('disabled');
      });
    } else {
      LogService.warn('Módulo nativo RNBluetoothClassic no disponible. Suscripciones de sistema omitidas.');
    }

    return () => {
      if (appStateDebounceTimer.current) {
        clearTimeout(appStateDebounceTimer.current);
      }
      appStateSub?.remove?.();
      onEnabledSub?.remove?.();
      onDisabledSub?.remove?.();
      unregDesconexion?.();
      unregDatos?.();
      usePocketStore.getState().resetStore();
    };
  }, []);

  return (
    <BluetoothContext.Provider value={store}>
      {children}
    </BluetoothContext.Provider>
  );
}

/**
 * Hook personalizado para acceder al estado Bluetooth en cualquier componente.
 * Mantiene 100% de compatibilidad con componentes existentes respaldado por Zustand.
 */
export function useBluetooth(): BluetoothContextType {
  const context = useContext(BluetoothContext);
  if (context === undefined) {
    throw new Error('useBluetooth debe ser usado dentro de un BluetoothProvider');
  }
  return context;
}
