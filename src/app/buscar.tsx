import { t } from '../styles/i18n';
import { useTema } from '../styles/styles';
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { mostrarModal } from '../components/Modal';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import BluetoothService, { DispositivoBT, SIN_NOMBRE, useBluetooth } from '../services/BluetoothService';
import { USUARIO_POR_DEFECTO, esLocker, esPinValido } from '../services/comun';
import { pedirPermisosBluetooth } from '../services/Permisos';
import { cerrarAplicacion } from '../services/Salir';
import { LogService } from '../services/StorageService';
import { BluetoothPermissionBlockedView } from '../components/buscar/BluetoothPermissionBlockedView';
import { DeviceDiscoveryListView } from '../components/buscar/DeviceDiscoveryListView';
import { ModalVincularDispositivo } from '../components/buscar/ModalVincularDispositivo';
import { RadarScannerView } from '../components/buscar/RadarScannerView';

const ESPERA_CONFIRMACION_MS = 1000;
const BUSQUEDA_AUTO_MS = 7000;
const LIMITE_AUTO_MS = 15000;
const VIGILANCIA_BLUETOOTH_MS = 1500;

const esperar = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

const fusionar = (lista: DispositivoBT[], nuevo: DispositivoBT): DispositivoBT[] => {
  const indice = lista.findIndex((d) => d.address.toLowerCase() === nuevo.address.toLowerCase());
  if (indice < 0) return [...lista, nuevo];
  const copia = [...lista];
  copia[indice] = nuevo;
  return copia;
};

export default function BuscarScreen() {
  useTema();
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
  const [bluetoothApagado, setBluetoothApagado] = useState(false);

  const autoDetectadoRef = useRef(false);
  const autoIniciadoRef = useRef(false);
  const busquedaEnProgresoRef = useRef(false);
  const apagadoRef = useRef(false);
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

  const marcarApagado = useCallback(() => {
    apagadoRef.current = true;
    setBluetoothApagado(true);
    setDispositivos([]);
    setEscaneando(false);
    setRefrescando(false);
    BluetoothService.cancelarDescubrimiento().catch(() => {});
  }, []);

  const avisarBluetoothNoDisponible = useCallback(
    () =>
      mostrarModal(t('pl_bt_no_disponible_titulo'), t('pl_bt_no_disponible_mensaje'), [
        { text: t('pl_salir'), rojo: true, onPress: cerrarAplicacion },
        { text: t('pl_ajustes'), onPress: onAbrirAjustesBluetooth },
      ]),
    [onAbrirAjustesBluetooth]
  );

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
        avisarBluetoothNoDisponible();
        return;
      }
      if (!(await pedirPermisosBluetooth())) {
        setFaltanPermisos(true);
        return;
      }
      setFaltanPermisos(false);

      if (!(await BluetoothService.estaEncendido())) {
        marcarApagado();
        return;
      }
      apagadoRef.current = false;
      setBluetoothApagado(false);
      setBluetoothNoDisponible(false);

      const lista = await BluetoothService.listarDispositivos((nuevo) => {
        if (!apagadoRef.current) setDispositivos((prev) => fusionar(prev, nuevo));
      });
      if (!apagadoRef.current) setDispositivos(lista);
    } catch (e: any) {
      LogService.error('[Buscar] La búsqueda manual de dispositivos falló', e);
      mostrarModal(t('pl_aviso'), t('pl_busqueda_fallida'));
    } finally {
      setEscaneando(false);
      setRefrescando(false);
      busquedaEnProgresoRef.current = false;
    }
  }, [avisarBluetoothNoDisponible, marcarApagado]);

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

      await esperar(ESPERA_CONFIRMACION_MS);
      if (!(await confirmarVinculacionDirecta(dev))) {
        pasarAManual();
        return;
      }

      setDispositivos((prev) => fusionar(prev, dev));
      setModoConexion('manual');
      iniciarVinculacion(dev);
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
        marcarApagado();
        setModoConexion('manual');
        return;
      }
      apagadoRef.current = false;
      setBluetoothApagado(false);
      setBluetoothNoDisponible(false);

      const lista = await BluetoothService.listarDispositivos((dev) => {
        if (!autoDetectadoRef.current && !apagadoRef.current && esLocker(dev)) vincularLockerDirecto(dev);
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
  }, [pasarAManual, detenerLimiteAuto, iniciarVinculacion, marcarApagado]);

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
    if (faltanPermisos || bluetoothNoDisponible) return;
    const vigilante = setInterval(async () => {
      let encendido = true;
      try {
        encendido = await BluetoothService.estaEncendido();
      } catch (e) {
        LogService.warn('[Buscar] No se pudo comprobar si el Bluetooth está encendido', e);
      }
      if (!encendido && !apagadoRef.current) {
        detenerLimiteAuto();
        autoDetectadoRef.current = true;
        busquedaEnProgresoRef.current = false;
        marcarApagado();
        setModoConexion('manual');
      } else if (encendido && apagadoRef.current) {
        apagadoRef.current = false;
        setBluetoothApagado(false);
        buscarDispositivos(false);
      }
    }, VIGILANCIA_BLUETOOTH_MS);
    return () => clearInterval(vigilante);
  }, [faltanPermisos, bluetoothNoDisponible, detenerLimiteAuto, marcarApagado, buscarDispositivos]);

  const activarBluetooth = useCallback(async () => {
    const activado = await BluetoothService.pedirActivar();
    if (!activado) LogService.info('[Buscar] El usuario no activó el Bluetooth desde la aplicación');
  }, []);

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
          if (bluetoothNoDisponible) return avisarBluetoothNoDisponible();
          autoDetectadoRef.current = false;
          busquedaEnProgresoRef.current = false;
          ejecutarAutoConexion();
        }}
        onSeleccionarDispositivo={iniciarVinculacion}
        bluetoothApagado={bluetoothApagado}
        onActivarBluetooth={activarBluetooth}
        onAbrirAjustesBluetooth={onAbrirAjustesBluetooth}
        onIrAjustes={() => router.push('/ajustes')}
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
