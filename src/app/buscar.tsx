import { t } from '../styles/i18n';
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { mostrarModal } from '../components/Modal';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import BluetoothService, { DispositivoBT, SIN_NOMBRE, useBluetooth } from '../services/BluetoothService';
import { DEFAULT_SECURITY_PIN, USUARIO_POR_DEFECTO, esLocker } from '../services/comun';
import { esPinValido, LogService } from '../services/StorageService';
import {
  DeviceDiscoveryListView,
  ModalVincularDispositivo,
  BluetoothPermissionBlockedView,
  RadarScannerView,
} from '../components/buscar/BuscarComponents';

const ESPERA_AVISO_MS = 1000;
const BUSQUEDA_AUTO_MS = 7000;
const LIMITE_AUTO_MS = 15000;

const esperar = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

// Añade un dispositivo encontrado a la lista, o lo actualiza si ya estaba (misma dirección).
const fusionar = (lista: DispositivoBT[], nuevo: DispositivoBT): DispositivoBT[] => {
  const indice = lista.findIndex((d) => d.address.toLowerCase() === nuevo.address.toLowerCase());
  if (indice < 0) return [...lista, nuevo];
  const copia = [...lista];
  copia[indice] = nuevo;
  return copia;
};

export default function BuscarScreen() {
  const { userName, actualizarDispositivoVinculado } = useBluetooth();

  const [modoConexion, setModoConexion] = useState<'auto' | 'manual'>('auto');
  const [detectado, setDetectado] = useState(false);

  const [escaneando, setEscaneando] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [dispositivos, setDispositivos] = useState<DispositivoBT[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [dispositivoSeleccionado, setDispositivoSeleccionado] = useState<DispositivoBT | null>(null);
  const [nombrePersonalizado, setNombrePersonalizado] = useState('');
  const [pinSeguridad, setPinSeguridad] = useState('');
  const [errorNombre, setErrorNombre] = useState<string | null>(null);
  const [errorPin, setErrorPin] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [faltanPermisos, setFaltanPermisos] = useState(false);
  const [bluetoothNoDisponible, setBluetoothNoDisponible] = useState(false);

  const autoDetectadoRef = useRef(false);
  const autoIniciadoRef = useRef(false);
  const busquedaEnProgresoRef = useRef(false);
  const autoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const detenerLimiteAuto = useCallback(() => {
    if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current);
  }, []);

  const onAbrirAjustesBluetooth = useCallback(async () => {
    try {
      await BluetoothService.abrirAjustesBluetooth();
    } catch (e) {
      LogService.warn('[Buscar] No se pudieron abrir los ajustes de Bluetooth', e);
      mostrarModal(t('pl_ajustes'), t('pl_ajustes_bluetooth_ayuda'));
    }
  }, []);

  const onAbrirAjustesApp = useCallback(async () => {
    try {
      await BluetoothService.abrirAjustesApp();
    } catch (e) {
      LogService.warn('[Buscar] No se pudieron abrir los ajustes de la app', e);
      mostrarModal(t('pl_ajustes'), t('pl_ajustes_permisos_ayuda', { app: t('pl_app_titulo') }));
    }
  }, []);

  // Empareja el dispositivo, lo guarda como el vinculado y entra en la pantalla principal.
  const vincularYEntrar = useCallback(
    async (dispositivo: DispositivoBT, nombre: string, pin: string) => {
      await BluetoothService.vincularDispositivo(dispositivo.address);
      await actualizarDispositivoVinculado(
        dispositivo.address,
        nombre,
        dispositivo.type || 'classic',
        pin,
        userName || USUARIO_POR_DEFECTO
      );
      router.replace('/puertas');
    },
    [actualizarDispositivoVinculado, userName]
  );

  const iniciarVinculacion = useCallback((dispositivo: DispositivoBT) => {
    BluetoothService.cancelarDescubrimiento().catch(() => {});
    setEscaneando(false);
    setDispositivoSeleccionado(dispositivo);
    setNombrePersonalizado(dispositivo.name && dispositivo.name !== SIN_NOMBRE ? dispositivo.name : t('pl_app_titulo'));
    setPinSeguridad('');
    setErrorNombre(null);
    setErrorPin(null);
    setModalVisible(true);
  }, []);

  const buscarDispositivos = useCallback(async (desdePullToRefresh: boolean = false) => {
    if (busquedaEnProgresoRef.current) return;
    busquedaEnProgresoRef.current = true;

    if (desdePullToRefresh) setRefrescando(true);
    else setEscaneando(true);
    setDispositivos([]);

    try {
      if (!(await BluetoothService.esSoportado())) {
        setBluetoothNoDisponible(true);
        mostrarModal(t('pl_bt_no_disponible_titulo'), t('pl_bt_no_disponible_mensaje'));
        return;
      }
      if (!(await BluetoothService.solicitarPermisos())) {
        setFaltanPermisos(true);
        return;
      }
      setFaltanPermisos(false);

      if (!(await BluetoothService.estaEncendido())) {
        const activado = await BluetoothService.pedirActivar();
        if (!activado) {
          mostrarModal(
            t('pl_bt_apagado_titulo'),
            t('pl_bt_apagado_mensaje', { app: t('pl_app_titulo') }),
            [{ text: t('pl_cancelar'), style: 'cancel' }, { text: t('pl_abrir_ajustes'), onPress: onAbrirAjustesBluetooth }]
          );
          return;
        }
      }

      const lista = await BluetoothService.listarDispositivos((nuevo) => setDispositivos((prev) => fusionar(prev, nuevo)));
      setDispositivos(lista);
    } catch (e: any) {
      LogService.error('[Buscar] La búsqueda manual de dispositivos falló', e);
      mostrarModal(t('pl_aviso'), e?.message || t('pl_busqueda_fallida'));
    } finally {
      setEscaneando(false);
      setRefrescando(false);
      busquedaEnProgresoRef.current = false;
    }
  }, [onAbrirAjustesBluetooth]);

  const pasarAManual = useCallback(() => {
    busquedaEnProgresoRef.current = false;
    setModoConexion('manual');
    buscarDispositivos(false);
  }, [buscarDispositivos]);

  const ejecutarAutoConexion = useCallback(async () => {
    if (busquedaEnProgresoRef.current) return;
    busquedaEnProgresoRef.current = true;
    autoDetectadoRef.current = false;
    setModoConexion('auto');
    setDetectado(false);

    detenerLimiteAuto();
    autoTimeoutRef.current = setTimeout(() => {
      if (!autoDetectadoRef.current) pasarAManual();
    }, LIMITE_AUTO_MS);

    const confirmarVinculacionDirecta = (dev: DispositivoBT) =>
      new Promise<boolean>((resolver) =>
        mostrarModal(t('pl_dispositivo_detectado'), t('pl_detectado_mensaje', { dispositivo: dev.name }), [
          { text: t('pl_cancelar'), style: 'cancel', onPress: () => resolver(false) },
          { text: t('pl_vincular'), onPress: () => resolver(true) },
        ])
      );

    const vincularLockerDirecto = async (dev: DispositivoBT) => {
      autoDetectadoRef.current = true;
      detenerLimiteAuto();
      setDetectado(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      BluetoothService.cancelarDescubrimiento().catch(() => {});

      await esperar(ESPERA_AVISO_MS);
      if (!(await confirmarVinculacionDirecta(dev))) {
        pasarAManual();
        return;
      }

      try {
        await vincularYEntrar(dev, t('pl_app_titulo'), DEFAULT_SECURITY_PIN);
      } catch (autoErr) {
        LogService.error('[Buscar] La vinculación automática falló', autoErr);
        setModoConexion('manual');
      }
    };

    try {
      if (!(await BluetoothService.esSoportado())) {
        detenerLimiteAuto();
        setBluetoothNoDisponible(true);
        setModoConexion('manual');
        return;
      }
      if (!(await BluetoothService.tienePermisos())) {
        detenerLimiteAuto();
        setFaltanPermisos(true);
        return;
      }
      setFaltanPermisos(false);

      if (!(await BluetoothService.estaEncendido())) {
        setModoConexion('manual');
        return;
      }

      const lista = await BluetoothService.listarDispositivos((dev) => {
        if (!autoDetectadoRef.current && esLocker(dev)) vincularLockerDirecto(dev);
      }, BUSQUEDA_AUTO_MS);

      if (!autoDetectadoRef.current) {
        const lockerEnLista = lista.find(esLocker);
        if (lockerEnLista) {
          await vincularLockerDirecto(lockerEnLista);
          return;
        }
        setDispositivos(lista);
        setModoConexion('manual');
      }
    } catch (e) {
      LogService.error('[Buscar] La búsqueda automática falló', e);
      if (!autoDetectadoRef.current) setModoConexion('manual');
    } finally {
      busquedaEnProgresoRef.current = false;
    }
  }, [pasarAManual, detenerLimiteAuto, vincularYEntrar]);

  const confirmarVinculacion = useCallback(async () => {
    if (!dispositivoSeleccionado) return;
    const nombre = nombrePersonalizado.trim() || dispositivoSeleccionado.name || t('pl_app_titulo');
    const pin = pinSeguridad.trim().toUpperCase();

    setErrorNombre(null);
    setErrorPin(null);

    if (!pin) {
      setErrorPin(t('pl_pin_vacio_error'));
      return;
    }
    if (!esPinValido(pin)) {
      setErrorPin(t('pl_pin_incorrecto_error'));
      return;
    }
    if (!esLocker(dispositivoSeleccionado)) {
      setErrorNombre(t('pl_vinculacion_error_mac', { app: t('pl_app_titulo') }));
      return;
    }

    setGuardando(true);
    try {
      await BluetoothService.cancelarDescubrimiento();
      await vincularYEntrar(dispositivoSeleccionado, nombre, pin);
      setModalVisible(false);
    } catch (e) {
      LogService.error(`[Buscar] Error al vincular ${dispositivoSeleccionado.address}`, e);
      setErrorNombre(t('pl_vinculacion_error_generico'));
    } finally {
      setGuardando(false);
    }
  }, [dispositivoSeleccionado, nombrePersonalizado, pinSeguridad, vincularYEntrar]);

  const handleCambiarAManual = useCallback(() => {
    autoDetectadoRef.current = true;
    detenerLimiteAuto();
    pasarAManual();
  }, [detenerLimiteAuto, pasarAManual]);

  useEffect(() => {
    if (!autoIniciadoRef.current) {
      autoIniciadoRef.current = true;
      ejecutarAutoConexion();
    }
    return detenerLimiteAuto;
  }, [ejecutarAutoConexion, detenerLimiteAuto]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && modoConexion === 'auto') {
        autoIniciadoRef.current = false;
        ejecutarAutoConexion();
      }
    });
    return () => sub.remove();
  }, [modoConexion, ejecutarAutoConexion]);

  if (faltanPermisos) {
    return (
      <BluetoothPermissionBlockedView
        onConcederPermisos={async () => {
          const ok = await BluetoothService.solicitarPermisos();
          setFaltanPermisos(!ok);
          if (ok) ejecutarAutoConexion();
        }}
        onAbrirAjustes={onAbrirAjustesApp}
      />
    );
  }

  if (modoConexion === 'auto') {
    return <RadarScannerView encontrado={detectado} onCambiarAManual={handleCambiarAManual} />;
  }

  return (
    <>
      <DeviceDiscoveryListView
        dispositivos={dispositivos}
        escaneando={escaneando}
        refrescando={refrescando}
        onBuscar={buscarDispositivos}
        onReintentarAuto={() => {
          autoDetectadoRef.current = false;
          busquedaEnProgresoRef.current = false;
          ejecutarAutoConexion();
        }}
        onSeleccionarDispositivo={iniciarVinculacion}
        onAbrirAjustesBluetooth={onAbrirAjustesBluetooth}
        bluetoothNoDisponible={bluetoothNoDisponible}
      />
      <ModalVincularDispositivo
        visible={modalVisible}
        guardando={guardando}
        nombrePersonalizado={nombrePersonalizado}
        setNombrePersonalizado={(valor) => {
          setNombrePersonalizado(valor);
          setErrorNombre(null);
        }}
        errorNombre={errorNombre}
        pinSeguridad={pinSeguridad}
        setPinSeguridad={(valor) => {
          setPinSeguridad(valor);
          setErrorPin(null);
        }}
        errorPin={errorPin}
        onCancel={() => setModalVisible(false)}
        onConfirm={confirmarVinculacion}
      />
    </>
  );
}
