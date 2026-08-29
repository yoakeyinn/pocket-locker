import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, NativeModules } from 'react-native';
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import StorageService, { DEFAULT_SECURITY_PIN } from '../services/StorageService';
import BluetoothService from '../services/BluetoothService';
import CryptoService from '../services/CryptoService';
import LogService from '../services/LogService';

/**
 * Posibles estados del adaptador y ciclo de vida de la conexión Bluetooth.
 */
export type BluetoothStatus =
  | 'disconnected'  // Desconectado pero emparejado
  | 'connecting'    // Intentando establecer enlace
  | 'connected'     // Enlace activo y listo para transmitir
  | 'unauthorized'  // Faltan permisos de Bluetooth / Localización en el SO
  | 'disabled'      // Adaptador Bluetooth del móvil apagado
  | 'unpaired';     // Ningún Pocket Locker vinculado en la app

/**
 * Interfaz pública expuesta por el contexto Bluetooth.
 */
export interface BluetoothContextType {
  status: BluetoothStatus;
  deviceName: string | null;
  deviceMac: string | null;
  deviceType: 'classic' | 'ble';
  devicePin: string;
  cargando: boolean;
  modoSimulacion: boolean;
  setModoSimulacion: (value: boolean) => void;
  conectar: () => Promise<void>;
  desconectar: () => Promise<void>;
  enviarComando: (comando: string) => Promise<void>;
  actualizarDispositivoVinculado: (mac: string, name: string, type?: 'classic' | 'ble', pin?: string) => Promise<void>;
  actualizarPinDispositivo: (nuevoPin: string) => Promise<void>;
  desvincularDispositivo: () => Promise<void>;
  renombrarDispositivo: (nuevoNombre: string) => Promise<void>;
}

const BluetoothContext = createContext<BluetoothContextType | undefined>(undefined);

/**
 * Proveedor principal del estado y operaciones Bluetooth para toda la aplicación.
 */
export function BluetoothProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<BluetoothStatus>('disconnected');
  const [deviceMac, setDeviceMac] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [deviceType, setDeviceType] = useState<'classic' | 'ble'>('classic');
  const [devicePin, setDevicePin] = useState<string>(DEFAULT_SECURITY_PIN);
  const [cargando, setCargando] = useState<boolean>(true);
  const [modoSimulacion, setModoSimulacion] = useState<boolean>(false);
  const statusRef = useRef<BluetoothStatus>('disconnected');
  const appStateDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  /**
   * Conecta al dispositivo Bluetooth registrado verificando permisos y estado del adaptador.
   */
  const conectarDispositivo = useCallback(async (macAddress: string, type: 'classic' | 'ble' = 'classic') => {
    if (!macAddress) return;
    setStatus('connecting');
    LogService.info(`Intentando conectar a ${macAddress} (${type})...`);

    if (modoSimulacion) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      setStatus('connected');
      LogService.info(`[SIMULACIÓN] Conectado con éxito a ${macAddress} (${type})`);
      return;
    }

    try {
      const soportado = await BluetoothService.esSoportado();
      if (!soportado) {
        setStatus('disabled');
        LogService.warn('Bluetooth no soportado en este dispositivo móvil.');
        return;
      }

      const encendido = await BluetoothService.estaEncendido();
      if (!encendido) {
        setStatus('disabled');
        LogService.warn('El adaptador Bluetooth se encuentra apagado.');
        return;
      }

      const okPermisos = await BluetoothService.solicitarPermisos();
      if (!okPermisos) {
        setStatus('unauthorized');
        LogService.warn('Permisos de Bluetooth denegados por el usuario.');
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

  /**
   * Cierra de forma explícita la conexión activa.
   */
  const desconectarDispositivo = useCallback(async () => {
    LogService.info('Desconectando Bluetooth de forma manual...');
    try {
      await BluetoothService.desconectar();
      setStatus('disconnected');
    } catch (e) {
      LogService.error('Error al desconectar manualmente', e);
    }
  }, []);

  /**
   * Envía un comando al locker utilizando el protocolo blindado.
   * Si el comando es un carácter simple ('E' o 'H'), lo transmite autenticado con el PIN
   * mediante la trama segura "PLK:<PIN>:<CMD>".
   */
  const enviarComandoBluetooth = useCallback(async (comando: string) => {
    LogService.info(`Solicitud de envío de comando: ${comando}`);

    if (modoSimulacion) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      LogService.info(`[SIMULACIÓN] Comando ${comando} procesado exitosamente`);
      return;
    }

    try {
      const mac = deviceMac || (await StorageService.getDeviceMac());
      const type = deviceType || (await StorageService.getDeviceType());
      const currentPin = devicePin || (await StorageService.getDevicePin());

      if (!mac) {
        throw new Error('No hay ningún dispositivo Pocket Locker vinculado');
      }

      // Si no estamos conectados, intentamos establecer enlace antes de enviar
      if (statusRef.current !== 'connected') {
        await conectarDispositivo(mac, type);
      }

      // Generar trama segura autenticada
      const payloadSeguro =
        comando.startsWith('PLK:') || comando.includes(':')
          ? comando
          : `PLK:${currentPin}:${comando}`;

      LogService.info(`Transmitiendo trama autenticada: ${payloadSeguro}`);
      const respuesta = await BluetoothService.enviarComandoConRespuesta(payloadSeguro, type);
      LogService.info(`Comando transmitido exitosamente con respuesta: ${respuesta}`);
    } catch (e: any) {
      LogService.error(`Error al transmitir comando ${comando}`, e);
      // Solo cambiar a disconnected si el error es de conexión de socket física
      if (
        e?.message?.includes('socket') ||
        e?.message?.includes('connect') ||
        e?.message?.includes('desconectado')
      ) {
        setStatus('disconnected');
      }
      throw e;
    }
  }, [deviceMac, deviceType, devicePin, conectarDispositivo, modoSimulacion]);

  /**
   * Registra un nuevo dispositivo emparejado y guarda su configuración de forma persistente.
   */
  const actualizarDispositivoVinculado = useCallback(
    async (
      mac: string,
      name: string,
      type: 'classic' | 'ble' = 'classic',
      pin: string = DEFAULT_SECURITY_PIN
    ) => {
      LogService.info(`Guardando nuevo dispositivo: ${name} (${mac}) tipo: ${type}`);
      try {
        await StorageService.saveDevice(mac, name, type, pin);
        setDeviceMac(mac);
        setDeviceName(name);
        setDeviceType(type);
        setDevicePin(pin);
        await conectarDispositivo(mac, type);
      } catch (e) {
        LogService.error('Error al guardar y conectar dispositivo', e);
        throw e;
      }
    },
    [conectarDispositivo]
  );

  /**
   * Actualiza el PIN de seguridad asignado al locker en el enclave seguro.
   */
  const actualizarPinDispositivo = useCallback(async (nuevoPin: string) => {
    try {
      await StorageService.saveDevicePin(nuevoPin);
      setDevicePin(nuevoPin);
      LogService.info('PIN de seguridad actualizado en el enclave seguro');
    } catch (e) {
      LogService.error('Error al actualizar PIN de seguridad', e);
      throw e;
    }
  }, []);

  /**
   * Desvincula el locker actual y limpia la persistencia local.
   */
  const desvincularDispositivo = useCallback(async () => {
    LogService.info('Desvinculando dispositivo Bluetooth...');
    try {
      await desconectarDispositivo();
      await StorageService.clearDevice();
      setDeviceMac(null);
      setDeviceName(null);
      setDeviceType('classic');
      setDevicePin(DEFAULT_SECURITY_PIN);
      setStatus('unpaired');
    } catch (e) {
      LogService.error('Error al desvincular dispositivo', e);
    }
  }, [desconectarDispositivo]);

  /**
   * Permite editar el nombre mostrado del locker.
   */
  const renombrarDispositivo = useCallback(
    async (nuevoNombre: string) => {
      if (!deviceMac) return;
      try {
        await StorageService.saveDevice(deviceMac, nuevoNombre, deviceType, devicePin);
        setDeviceName(nuevoNombre);
      } catch (e) {
        LogService.error('Error al renombrar dispositivo', e);
        throw e;
      }
    },
    [deviceMac, deviceType, devicePin]
  );

  // Carga inicial al montar el proveedor en el arranque de la app
  useEffect(() => {
    const inicializar = async () => {
      try {
        const { mac, name, type, pin } = await StorageService.obtenerDispositivo();
        if (mac) {
          setDeviceMac(mac);
          setDeviceName(name);
          setDeviceType(type);
          setDevicePin(pin);
          setStatus('disconnected');
          // Intenta pre-conectar en segundo plano
          try {
            await conectarDispositivo(mac, type);
          } catch {
            // Ignorar fallos de auto-conexión iniciales
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

  // Escuchar desconexión física reportada por el servicio
  useEffect(() => {
    BluetoothService.registrarOnDesconexion(() => {
      LogService.warn('Desconexión física reportada por el servicio Bluetooth.');
      setStatus('disconnected');
    });

    BluetoothService.registrarOnDatosRecibidos((linea) => {
      LogService.info(`[TELEMETRÍA RX] Respuesta del Locker: ${linea}`);
    });
  }, []);

  // Escuchar ciclo de vida de la aplicación con throttling/debounce anti-rebote
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      LogService.info(`Estado de la aplicación cambió a: ${nextAppState}`);

      if (appStateDebounceTimer.current) {
        clearTimeout(appStateDebounceTimer.current);
        appStateDebounceTimer.current = null;
      }

      if (nextAppState === 'active') {
        // Debounce de 1200ms para evitar ráfagas si el usuario alterna rápidamente entre apps
        appStateDebounceTimer.current = setTimeout(async () => {
          const mac = deviceMac || (await StorageService.getDeviceMac());
          const type = deviceType || (await StorageService.getDeviceType());
          if (mac && statusRef.current !== 'connected' && statusRef.current !== 'connecting') {
            try {
              await conectarDispositivo(mac, type);
            } catch {
              // Ignorar fallos de reconexión al regresar a primer plano
            }
          }
        }, 1200);
      } else if (nextAppState === 'background') {
        LogService.info('App en segundo plano. Liberando enlace Bluetooth...');
        try {
          await BluetoothService.desconectar();
          setStatus('disconnected');
        } catch (e) {
          LogService.error('Error al desconectar Bluetooth en segundo plano', e);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      if (appStateDebounceTimer.current) {
        clearTimeout(appStateDebounceTimer.current);
      }
      subscription.remove();
    };
  }, [deviceMac, deviceType, conectarDispositivo]);

  // Escuchar cambios de estado del adaptador Bluetooth en el sistema (on/off)
  useEffect(() => {
    if (!NativeModules.RNBluetoothClassic || !(RNBluetoothClassic as any)._nativeModule) {
      LogService.warn('Módulo nativo RNBluetoothClassic no disponible. Suscripciones de sistema omitidas.');
      return;
    }

    const onEnabledSubscription = RNBluetoothClassic.onBluetoothEnabled(async () => {
      LogService.info('Adaptador Bluetooth activado en el sistema operativo.');
      const mac = deviceMac || (await StorageService.getDeviceMac());
      const type = deviceType || (await StorageService.getDeviceType());
      if (mac) {
        setStatus('disconnected');
        try {
          await conectarDispositivo(mac, type);
        } catch {
          // Ignorar fallos de auto-conexión
        }
      } else {
        setStatus('unpaired');
      }
    });

    const onDisabledSubscription = RNBluetoothClassic.onBluetoothDisabled(() => {
      LogService.info('Adaptador Bluetooth desactivado en el sistema operativo.');
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
        devicePin,
        cargando,
        modoSimulacion,
        setModoSimulacion,
        conectar: () =>
          deviceMac ? conectarDispositivo(deviceMac, deviceType) : Promise.reject('No device paired'),
        desconectar: desconectarDispositivo,
        enviarComando: enviarComandoBluetooth,
        actualizarDispositivoVinculado,
        actualizarPinDispositivo,
        desvincularDispositivo,
        renombrarDispositivo,
      }}
    >
      {children}
    </BluetoothContext.Provider>
  );
}

/**
 * Hook personalizado para acceder al contexto Bluetooth en cualquier componente.
 */
export function useBluetooth() {
  const context = useContext(BluetoothContext);
  if (context === undefined) {
    throw new Error('useBluetooth debe ser usado dentro de un BluetoothProvider');
  }
  return context;
}


