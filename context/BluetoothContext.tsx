import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, NativeModules } from 'react-native';
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import StorageService from '../services/StorageService';
import BluetoothService from '../services/BluetoothService';
import LogService from '../services/LogService';

export type BluetoothStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'unauthorized'
  | 'disabled'
  | 'unpaired';

export interface BluetoothContextType {
  status: BluetoothStatus;
  deviceName: string | null;
  deviceMac: string | null;
  deviceType: 'classic' | 'ble';
  cargando: boolean;
  modoSimulacion: boolean;
  setModoSimulacion: (value: boolean) => void;
  conectar: () => Promise<void>;
  desconectar: () => Promise<void>;
  enviarComando: (comando: string) => Promise<void>;
  actualizarDispositivoVinculado: (mac: string, name: string, type?: 'classic' | 'ble') => Promise<void>;
  desvincularDispositivo: () => Promise<void>;
  renombrarDispositivo: (nuevoNombre: string) => Promise<void>;
}

const BluetoothContext = createContext<BluetoothContextType | undefined>(undefined);

export function BluetoothProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<BluetoothStatus>('disconnected');
  const [deviceMac, setDeviceMac] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [deviceType, setDeviceType] = useState<'classic' | 'ble'>('classic');
  const [cargando, setCargando] = useState<boolean>(true);
  const [modoSimulacion, setModoSimulacion] = useState<boolean>(false);
  const statusRef = useRef<BluetoothStatus>('disconnected');

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const conectarDispositivo = useCallback(async (macAddress: string, type: 'classic' | 'ble' = 'classic') => {
    if (!macAddress) return;
    setStatus('connecting');
    LogService.info(`Intentando conectar a ${macAddress} (${type})...`);
    
    if (modoSimulacion) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setStatus('connected');
      LogService.info(`[SIMULACIÓN] Conectado con éxito a ${macAddress} (${type})`);
      return;
    }

    try {
      const soportado = await BluetoothService.esSoportado();
      if (!soportado) {
        setStatus('disabled');
        LogService.warn('Bluetooth no soportado en este dispositivo.');
        return;
      }

      const encendido = await BluetoothService.estaEncendido();
      if (!encendido) {
        setStatus('disabled');
        LogService.warn('Bluetooth apagado.');
        return;
      }

      const okPermisos = await BluetoothService.solicitarPermisos();
      if (!okPermisos) {
        setStatus('unauthorized');
        LogService.warn('Permisos de Bluetooth no concedidos.');
        return;
      }

      await BluetoothService.conectar(macAddress, type);
      setStatus('connected');
      LogService.info(`Conectado con éxito a ${macAddress} (${type})`);
    } catch (e: any) {
      setStatus('disconnected');
      LogService.error(`Fallo al conectar a ${macAddress} (${type})`, e);
      throw e;
    }
  }, [modoSimulacion]);

  const desconectarDispositivo = useCallback(async () => {
    LogService.info('Desconectando Bluetooth de forma manual...');
    try {
      await BluetoothService.desconectar();
      setStatus('disconnected');
    } catch (e) {
      LogService.error('Error al desconectar manualmente', e);
    }
  }, []);

  const enviarComandoBluetooth = useCallback(async (comando: string) => {
    LogService.info(`Enviando comando: ${comando}`);
    
    if (modoSimulacion) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      LogService.info(`[SIMULACIÓN] Comando ${comando} enviado con éxito`);
      return;
    }

    try {
      const mac = deviceMac || (await StorageService.getDeviceMac());
      const type = deviceType || (await StorageService.getDeviceType());
      if (!mac) {
        throw new Error('No hay dispositivo vinculado');
      }

      if (statusRef.current !== 'connected') {
        await conectarDispositivo(mac, type);
      }
      await BluetoothService.enviarComando(comando, type);
      LogService.info(`Comando ${comando} enviado con éxito`);
    } catch (e: any) {
      LogService.error(`Error al enviar el comando ${comando}`, e);
      setStatus('disconnected');
      throw e;
    }
  }, [deviceMac, deviceType, conectarDispositivo, modoSimulacion]);

  const actualizarDispositivoVinculado = useCallback(async (mac: string, name: string, type: 'classic' | 'ble' = 'classic') => {
    LogService.info(`Guardando nuevo dispositivo: ${name} (${mac}) tipo: ${type}`);
    try {
      await StorageService.saveDevice(mac, name, type);
      setDeviceMac(mac);
      setDeviceName(name);
      setDeviceType(type);
      await conectarDispositivo(mac, type);
    } catch (e) {
      LogService.error('Error al guardar y conectar dispositivo', e);
      throw e;
    }
  }, [conectarDispositivo]);

  const desvincularDispositivo = useCallback(async () => {
    LogService.info('Desvinculando dispositivo Bluetooth...');
    try {
      await desconectarDispositivo();
      await StorageService.clearDevice();
      setDeviceMac(null);
      setDeviceName(null);
      setDeviceType('classic');
      setStatus('unpaired');
    } catch (e) {
      LogService.error('Error al desvincular dispositivo', e);
    }
  }, [desconectarDispositivo]);

  const renombrarDispositivo = useCallback(async (nuevoNombre: string) => {
    if (!deviceMac) return;
    try {
      await StorageService.saveDevice(deviceMac, nuevoNombre, deviceType);
      setDeviceName(nuevoNombre);
    } catch (e) {
      LogService.error('Error al renombrar dispositivo', e);
      throw e;
    }
  }, [deviceMac, deviceType]);

  // Carga inicial al montar el proveedor
  useEffect(() => {
    const inicializar = async () => {
      try {
        const { mac, name, type } = await StorageService.obtenerDispositivo();
        if (mac) {
          setDeviceMac(mac);
          setDeviceName(name);
          setDeviceType(type);
          setStatus('disconnected');
          // Intenta pre-conectar en background
          try {
            await conectarDispositivo(mac, type);
          } catch {
            // Ignorar fallos de conexión automáticos iniciales
          }
        } else {
          setStatus('unpaired');
        }
      } catch (e) {
        LogService.error('Error cargando dispositivo guardado al inicio', e);
        setStatus('unpaired');
      } finally {
        setCargando(false);
      }
    };
    inicializar();
  }, [conectarDispositivo]);

  // Escuchar desconexión activa reportada por el servicio
  useEffect(() => {
    BluetoothService.registrarOnDesconexion(() => {
      LogService.warn('Desconexión detectada de forma activa desde el dispositivo.');
      setStatus('disconnected');
    });
  }, []);

  // Escuchar ciclo de vida de la App para abrir/cerrar conexión
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      LogService.info(`AppState cambió a ${nextAppState}`);
      if (nextAppState === 'active') {
        const mac = deviceMac || (await StorageService.getDeviceMac());
        const type = deviceType || (await StorageService.getDeviceType());
        if (mac) {
          try {
            await conectarDispositivo(mac, type);
          } catch {
            // Ignorar fallos de auto-conexión al volver del background
          }
        }
      } else if (nextAppState === 'background') {
        LogService.info('App minimizada. Desconectando Bluetooth...');
        try {
          await BluetoothService.desconectar();
          setStatus('disconnected');
        } catch (e) {
          LogService.error('Error al desconectar Bluetooth en AppState background', e);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [deviceMac, deviceType, conectarDispositivo]);

  // Escuchar cambios de estado del adaptador Bluetooth en el sistema (on/off)
  useEffect(() => {
    if (!NativeModules.RNBluetoothClassic || !(RNBluetoothClassic as any)._nativeModule) {
      LogService.warn('El módulo nativo RNBluetoothClassic no está disponible. Las suscripciones han sido ignoradas.');
      return;
    }

    const onEnabledSubscription = RNBluetoothClassic.onBluetoothEnabled(async () => {
      LogService.info('Bluetooth activado en el sistema.');
      const mac = deviceMac || (await StorageService.getDeviceMac());
      const type = deviceType || (await StorageService.getDeviceType());
      if (mac) {
        setStatus('disconnected');
        try {
          await conectarDispositivo(mac, type);
        } catch {
          // Ignorar fallos de auto-conexión iniciales
        }
      } else {
        setStatus('unpaired');
      }
    });

    const onDisabledSubscription = RNBluetoothClassic.onBluetoothDisabled(() => {
      LogService.info('Bluetooth desactivado en el sistema.');
      setStatus('disabled');
    });

    return () => {
      onEnabledSubscription.remove();
      onDisabledSubscription.remove();
    };
  }, [deviceMac, deviceType, conectarDispositivo]);

  return (
    <BluetoothContext.Provider
      value={{
        status,
        deviceName,
        deviceMac,
        deviceType,
        cargando,
        modoSimulacion,
        setModoSimulacion,
        conectar: () => (deviceMac ? conectarDispositivo(deviceMac, deviceType) : Promise.reject('No device paired')),
        desconectar: desconectarDispositivo,
        enviarComando: enviarComandoBluetooth,
        actualizarDispositivoVinculado,
        desvincularDispositivo,
        renombrarDispositivo,
      }}
    >
      {children}
    </BluetoothContext.Provider>
  );
}

export function useBluetooth() {
  const context = useContext(BluetoothContext);
  if (context === undefined) {
    throw new Error('useBluetooth debe ser usado dentro de un BluetoothProvider');
  }
  return context;
}
