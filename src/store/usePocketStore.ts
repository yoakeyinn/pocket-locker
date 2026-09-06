import { create } from 'zustand';
import StorageService, { DEFAULT_SECURITY_PIN, parsearYValidarPin } from '../services/StorageService';
import BluetoothService from '../services/BluetoothService';
import LogService from '../services/LogService';
import { PocketStore, PocketState, UsuarioAdmin, BluetoothStatus } from './types';

export const initialMockUsuariosAdmin: UsuarioAdmin[] = [
  {
    mac: 'AA:BB:CC:DD:EE:01',
    nombre: 'Carlos Demo',
    diasRestantes: 14,
    peatonal: true,
    garaje: true,
    bloqueado: false,
  },
  {
    mac: '11:22:33:44:55:66',
    nombre: 'Invitado Expirado',
    diasRestantes: 0,
    peatonal: true,
    garaje: false,
    bloqueado: true,
  },
  {
    mac: 'DE:MO:50:00:00:00',
    nombre: 'DEMO (Admin)',
    diasRestantes: 99,
    peatonal: true,
    garaje: true,
    bloqueado: false,
  },
];

export const initialPocketState: PocketState = {
  status: 'disconnected',
  deviceMac: null,
  deviceName: null,
  deviceType: 'classic',
  devicePin: DEFAULT_SECURITY_PIN,
  cargando: true,
  tiempoRestanteBloqueo: 0,
  ultimaPuerta: 'peatonal',
  userRole: 'user',
  userName: null,
  permisos: { peatonal: true, garaje: true },
  diasRestantes: null,
  estaBloqueado: false,
  isDemoMode: false,
  mockUsuariosAdmin: initialMockUsuariosAdmin,
};

let bloqueoIntervalId: any = null;

export const usePocketStore = create<PocketStore>((set, get) => ({
  ...initialPocketState,

  setStatus: (status: BluetoothStatus) => set({ status }),
  setCargando: (cargando: boolean) => set({ cargando }),

  resetStore: () => {
    if (bloqueoIntervalId) {
      clearInterval(bloqueoIntervalId);
      bloqueoIntervalId = null;
    }
    set({
      ...initialPocketState,
      mockUsuariosAdmin: [...initialMockUsuariosAdmin],
    });
  },

  guardarUltimaPuerta: async (puerta: 'peatonal' | 'garaje') => {
    set({ ultimaPuerta: puerta });
    await StorageService.saveUltimaPuerta(puerta);
  },

  iniciarBloqueoMargen: (segundos: number = 5) => {
    if (bloqueoIntervalId) {
      clearInterval(bloqueoIntervalId);
      bloqueoIntervalId = null;
    }
    set({ tiempoRestanteBloqueo: segundos });
    bloqueoIntervalId = setInterval(() => {
      const prev = get().tiempoRestanteBloqueo;
      if (prev <= 1) {
        if (bloqueoIntervalId) {
          clearInterval(bloqueoIntervalId);
          bloqueoIntervalId = null;
        }
        set({ tiempoRestanteBloqueo: 0 });
      } else {
        set({ tiempoRestanteBloqueo: prev - 1 });
      }
    }, 1000);
  },

  activarModoDemo: async () => {
    set({
      isDemoMode: true,
      deviceMac: 'DE:MO:50:00:00:00',
      deviceName: 'Pocket Locker (DEMO)',
      deviceType: 'classic',
      devicePin: '2415',
      userName: 'DEMO',
      userRole: 'admin',
      permisos: { peatonal: true, garaje: true },
      diasRestantes: 99,
      estaBloqueado: false,
      status: 'connected',
      ultimaPuerta: 'peatonal',
    });
    LogService.info('Modo DEMO / Simulación activado');
  },

  desactivarModoDemo: async () => {
    const stored = await StorageService.obtenerDispositivo();
    const savedUser = await StorageService.getUserName();
    set({
      isDemoMode: false,
      deviceMac: stored.mac,
      deviceName: stored.name,
      deviceType: stored.type,
      devicePin: stored.pin || DEFAULT_SECURITY_PIN,
      userName: stored.userName || savedUser || null,
      userRole: stored.role,
      permisos: stored.permisos,
      diasRestantes: stored.diasRestantes,
      estaBloqueado: stored.estaBloqueado,
      status: stored.mac ? 'disconnected' : 'unpaired',
    });
    LogService.info('Modo DEMO / Simulación desactivado');
  },

  guardarNombreUsuario: async (nombre: string) => {
    const limpio = nombre.trim();
    const esAdmin = limpio === '2415';
    set({
      userName: limpio,
      userRole: esAdmin ? 'admin' : 'user',
    });
    await StorageService.saveUserName(limpio);
    const stored = await StorageService.obtenerDispositivo();
    if (stored.mac) {
      await StorageService.saveDevice(
        stored.mac,
        stored.name || 'Pocket Locker',
        stored.type,
        stored.pin || DEFAULT_SECURITY_PIN,
        limpio
      );
    }
  },

  sincronizarConLocker: async () => {
    if (get().isDemoMode) return;
    try {
      const type = get().deviceType || (await StorageService.getDeviceType());
      const nowSec = Math.floor(Date.now() / 1000);
      const res = await BluetoothService.enviarComandoConRespuesta(`PLK:SYNC:${nowSec}`, type, 2500);
      if (res.startsWith('INFO:')) {
        const partes = res.replace('INFO:', '').trim().split(':');
        const estadoStr = partes[0];
        const diasStr = partes[1];
        const pStr = partes[2];
        const gStr = partes[3];

        const bloqueado = estadoStr === 'BLOQUEADO';
        const dias = diasStr && diasStr !== '-1' ? parseInt(diasStr, 10) : null;
        const p = pStr === '1';
        const g = gStr === '1';

        set({
          estaBloqueado: bloqueado,
          diasRestantes: dias,
          permisos: { peatonal: p, garaje: g },
        });

        await StorageService.updateUserStatus(dias, bloqueado, { peatonal: p, garaje: g });
        LogService.info(`Sincronización con locker exitosa: ${estadoStr}, dias: ${dias}, P:${p}, G:${g}`);
      }
    } catch (e) {
      LogService.warn('Aviso en sincronización con locker:', e);
    }
  },

  conectarDispositivo: async (macAddress: string, type: 'classic' | 'ble' = 'classic') => {
    if (get().isDemoMode) {
      set({ status: 'connected' });
      return;
    }
    if (!macAddress) return;
    set({ status: 'connecting' });
    LogService.info(`Intentando conectar a ${macAddress} (${type})...`);

    try {
      const soportado = await BluetoothService.esSoportado();
      if (!soportado) {
        set({ status: 'disabled' });
        LogService.warn('Bluetooth no soportado en este dispositivo móvil.');
        return;
      }

      const encendido = await BluetoothService.estaEncendido();
      if (!encendido) {
        set({ status: 'disabled' });
        LogService.warn('El adaptador Bluetooth se encuentra apagado.');
        return;
      }

      const okPermisos = await BluetoothService.solicitarPermisos();
      if (!okPermisos) {
        set({ status: 'unauthorized' });
        LogService.warn('Permisos de Bluetooth denegados por el usuario.');
        return;
      }

      await BluetoothService.conectar(macAddress, type);
      set({ status: 'connected' });
      LogService.info(`Conectado con éxito a ${macAddress} (${type})`);

      // Sincronizar automáticamente en cuanto se establece el enlace
      await get().sincronizarConLocker().catch(() => {});
    } catch (e: any) {
      set({ status: 'disconnected' });
      LogService.error(`Fallo al conectar a ${macAddress} (${type})`, e);
      throw e;
    }
  },

  conectar: async () => {
    const { deviceMac, deviceType } = get();
    if (deviceMac) {
      return get().conectarDispositivo(deviceMac, deviceType);
    }
    return Promise.reject('No device paired');
  },

  desconectar: async () => {
    LogService.info('Desconectando Bluetooth de forma manual...');
    if (get().isDemoMode) {
      set({ status: 'disconnected' });
      return;
    }
    try {
      await BluetoothService.desconectar();
      set({ status: 'disconnected' });
    } catch (e) {
      LogService.error('Error al desconectar manualmente', e);
    }
  },

  enviarComando: async (comando: string) => {
    LogService.info(`Solicitud de envío de comando: ${comando}`);

    if (get().isDemoMode) {
      LogService.info(`[DEMO] Simulando ejecución de comando: ${comando}`);
      let comandoNormalizado = comando;
      if (comando === 'E') comandoNormalizado = 'P';
      if (comando === 'H') comandoNormalizado = 'G';

      await new Promise((r) => setTimeout(r, 200));
      if (comandoNormalizado === 'P' || comandoNormalizado.endsWith(':P') || comando === 'E') {
        get().guardarUltimaPuerta('peatonal').catch(() => {});
      } else if (comandoNormalizado === 'G' || comandoNormalizado.endsWith(':G') || comando === 'H') {
        get().guardarUltimaPuerta('garaje').catch(() => {});
      }
      return;
    }

    try {
      const mac = get().deviceMac || (await StorageService.getDeviceMac());
      const type = get().deviceType || (await StorageService.getDeviceType());
      const currentPin = get().devicePin || (await StorageService.getDevicePin());

      if (!mac) {
        throw new Error('No hay ningún dispositivo Pocket Locker vinculado');
      }

      if (get().status !== 'connected') {
        await get().conectarDispositivo(mac, type);
      }

      let accion = comando;
      if (accion === 'P' || accion === 'PUERTA') {
        accion = 'E';
      } else if (accion === 'G' || accion === 'PORTON' || accion === 'GARAJE') {
        accion = 'H';
      } else if (accion.startsWith('PLK:') && accion.includes(':')) {
        const partes = accion.split(':');
        const cmd = partes[partes.length - 1];
        if (cmd === 'P' || cmd === 'PUERTA') {
          partes[partes.length - 1] = 'E';
          accion = partes.join(':');
        } else if (cmd === 'G' || cmd === 'PORTON' || cmd === 'GARAJE') {
          partes[partes.length - 1] = 'H';
          accion = partes.join(':');
        }
      }

      const payloadSeguro =
        accion.startsWith('PLK:') || accion.includes(':')
          ? accion
          : `PLK:${currentPin}:${accion}`;

      LogService.info(`Transmitiendo trama autenticada: ${payloadSeguro}`);
      const respuesta = await BluetoothService.enviarComandoConRespuesta(payloadSeguro, type);
      LogService.info(`Comando transmitido exitosamente con respuesta: ${respuesta}`);

      if (
        comando === 'P' ||
        comando === 'E' ||
        accion === 'E' ||
        accion.endsWith(':E')
      ) {
        await get().guardarUltimaPuerta('peatonal').catch(() => {});
      } else if (
        comando === 'G' ||
        comando === 'H' ||
        accion === 'H' ||
        accion.endsWith(':H')
      ) {
        await get().guardarUltimaPuerta('garaje').catch(() => {});
      }
    } catch (e: any) {
      LogService.error(`Error al transmitir comando ${comando}`, e);
      if (
        e?.message?.includes('socket') ||
        e?.message?.includes('connect') ||
        e?.message?.includes('desconectado')
      ) {
        set({ status: 'disconnected' });
      }
      throw e;
    }
  },

  actualizarDispositivoVinculado: async (
    mac: string,
    name: string,
    type: 'classic' | 'ble' = 'classic',
    pin: string = DEFAULT_SECURITY_PIN,
    user?: string
  ) => {
    const usuarioFinal = user || get().userName || (await StorageService.getUserName()) || 'Usuario';
    const esAdmin = usuarioFinal === '2415';
    LogService.info(`Guardando nuevo dispositivo: ${name} (${mac}) usuario: ${usuarioFinal}`);
    try {
      await StorageService.saveDevice(mac, name, type, pin, usuarioFinal);
      const parsed = parsearYValidarPin(pin);

      set({
        deviceMac: mac,
        deviceName: name,
        deviceType: type,
        devicePin: pin,
        userName: usuarioFinal,
        userRole: esAdmin ? 'admin' : 'user',
        permisos: { peatonal: parsed.peatonal, garaje: parsed.garaje },
        diasRestantes: parsed.dias,
        estaBloqueado: false,
      });

      if (get().isDemoMode) {
        set({ status: 'connected' });
        return;
      }

      try {
        await get().conectarDispositivo(mac, type);

        try {
          await BluetoothService.enviarComandoConRespuesta(`PLK:REG:${usuarioFinal}:${pin}`, type, 2500);
          await get().sincronizarConLocker();
        } catch (regErr) {
          LogService.warn('Aviso registrando usuario en ESP32:', regErr);
        }
      } catch (connErr) {
        LogService.warn('Aviso en conexión inicial tras vincular (continuando guardado):', connErr);
      }
    } catch (e) {
      LogService.error('Error al guardar credenciales de dispositivo', e);
      throw e;
    }
  },

  actualizarPinDispositivo: async (nuevoPin: string) => {
    try {
      await StorageService.saveDevicePin(nuevoPin);
      set({ devicePin: nuevoPin });
      const parsed = parsearYValidarPin(nuevoPin);
      const esAdmin = get().userName === '2415';
      set({
        userRole: esAdmin ? 'admin' : 'user',
        permisos: { peatonal: parsed.peatonal, garaje: parsed.garaje },
        diasRestantes: parsed.dias,
      });
      LogService.info('PIN de seguridad actualizado en el enclave seguro');
    } catch (e) {
      LogService.error('Error al actualizar PIN de seguridad', e);
      throw e;
    }
  },

  desvincularDispositivo: async () => {
    LogService.info('Desvinculando dispositivo Bluetooth...');
    try {
      await get().desconectar();
      await StorageService.clearDevice();
      set({
        deviceMac: null,
        deviceName: null,
        deviceType: 'classic',
        devicePin: DEFAULT_SECURITY_PIN,
        ultimaPuerta: 'peatonal',
        userRole: 'user',
        userName: null,
        permisos: { peatonal: true, garaje: true },
        diasRestantes: null,
        estaBloqueado: false,
        status: 'unpaired',
      });
    } catch (e) {
      LogService.error('Error al desvincular dispositivo', e);
    }
  },

  renombrarDispositivo: async (nuevoNombre: string) => {
    const { deviceMac, deviceType, devicePin, userName } = get();
    if (!deviceMac) return;
    try {
      await StorageService.saveDevice(deviceMac, nuevoNombre, deviceType, devicePin, userName || 'Usuario');
      set({ deviceName: nuevoNombre });
    } catch (e) {
      LogService.error('Error al renombrar dispositivo', e);
      throw e;
    }
  },

  obtenerListaUsuarios: async (): Promise<UsuarioAdmin[]> => {
    if (get().isDemoMode) {
      return get().mockUsuariosAdmin;
    }
    try {
      const type = get().deviceType || (await StorageService.getDeviceType());
      const lineas = await BluetoothService.enviarComandoEsperarLineas('PLK:ADMIN:LIST', 'END:USERS', type, 3500);
      const usuarios: UsuarioAdmin[] = [];
      for (const l of lineas) {
        if (l.startsWith('USER:')) {
          const partes = l.replace('USER:', '').trim().split(':');
          if (partes.length >= 6) {
            // Manejo robusto de MACs con dos puntos (11:22:33:44:55:66) parseando desde el final
            const bloqueado = partes[partes.length - 1] === 'BLOQUEADO';
            const diasRestantes = parseInt(partes[partes.length - 2], 10);
            const garaje = partes[partes.length - 3] === '1';
            const peatonal = partes[partes.length - 4] === '1';
            const nombre = partes[partes.length - 5];
            const mac = partes.slice(0, partes.length - 5).join(':');

            usuarios.push({
              mac,
              nombre,
              peatonal,
              garaje,
              diasRestantes: isNaN(diasRestantes) ? 0 : diasRestantes,
              bloqueado,
            });
          }
        }
      }
      return usuarios;
    } catch (e) {
      LogService.error('Error obteniendo lista de usuarios admin', e);
      return [];
    }
  },

  desbloquearUsuario: async (mac: string): Promise<boolean> => {
    if (get().isDemoMode) {
      set((state) => ({
        mockUsuariosAdmin: state.mockUsuariosAdmin.map((u) =>
          u.mac.toLowerCase() === mac.toLowerCase() ? { ...u, bloqueado: false, diasRestantes: 30 } : u
        ),
      }));
      return true;
    }
    try {
      const type = get().deviceType || (await StorageService.getDeviceType());
      const res = await BluetoothService.enviarComandoConRespuesta(`PLK:ADMIN:UNBLOCK:${mac}`, type, 2500);
      return res.includes('OK:UNBLOCKED');
    } catch (e) {
      LogService.error('Error desbloqueando usuario', e);
      return false;
    }
  },

  modificarUsuario: async (mac: string, dias: number, p: boolean, g: boolean): Promise<boolean> => {
    if (get().isDemoMode) {
      set((state) => ({
        mockUsuariosAdmin: state.mockUsuariosAdmin.map((u) =>
          u.mac.toLowerCase() === mac.toLowerCase()
            ? { ...u, diasRestantes: dias, peatonal: p, garaje: g, bloqueado: false }
            : u
        ),
      }));
      return true;
    }
    try {
      const type = get().deviceType || (await StorageService.getDeviceType());
      const res = await BluetoothService.enviarComandoConRespuesta(
        `PLK:ADMIN:SET:${mac}:${dias}:${p ? 1 : 0}:${g ? 1 : 0}`,
        type,
        2500
      );
      return res.includes('OK:USER_UPDATED');
    } catch (e) {
      LogService.error('Error modificando usuario', e);
      return false;
    }
  },

  eliminarUsuario: async (mac: string): Promise<boolean> => {
    if (get().isDemoMode) {
      set((state) => ({
        mockUsuariosAdmin: state.mockUsuariosAdmin.filter((u) => u.mac.toLowerCase() !== mac.toLowerCase()),
      }));
      return true;
    }
    try {
      const type = get().deviceType || (await StorageService.getDeviceType());
      const res = await BluetoothService.enviarComandoConRespuesta(`PLK:ADMIN:DEL:${mac}`, type, 2500);
      return res.includes('OK:USER_DELETED');
    } catch (e) {
      LogService.error('Error eliminando usuario', e);
      return false;
    }
  },

  inicializar: async () => {
    if (get().isDemoMode) {
      set({ cargando: false });
      return;
    }
    set({
      deviceMac: null,
      deviceName: null,
      cargando: true,
    });
    try {
      const [dispositivo, puertaGuardada, savedUserName] = await Promise.all([
        StorageService.obtenerDispositivo(),
        StorageService.getUltimaPuerta(),
        StorageService.getUserName(),
      ]);

      const {
        mac,
        name,
        userName: uName,
        type,
        pin,
        role,
        permisos: uPerm,
        diasRestantes: uDias,
        estaBloqueado: uBloq,
      } = dispositivo;

      const effectiveUser = uName || savedUserName || null;
      const esAdmin = effectiveUser === '2415';

      if (mac) {
        set({
          deviceMac: mac,
          deviceName: name,
          deviceType: type || 'classic',
          devicePin: pin || DEFAULT_SECURITY_PIN,
          userRole: esAdmin ? 'admin' : 'user',
          userName: effectiveUser,
          permisos: uPerm || { peatonal: true, garaje: true },
          diasRestantes: uDias !== undefined ? uDias : null,
          estaBloqueado: !!uBloq,
          ultimaPuerta: puertaGuardada || 'peatonal',
          status: 'disconnected',
        });

        try {
          await get().conectarDispositivo(mac, type || 'classic');
        } catch {
          // Ignorar fallos de auto-conexión iniciales
        }
      } else {
        set({
          deviceMac: null,
          deviceName: null,
          deviceType: 'classic',
          devicePin: DEFAULT_SECURITY_PIN,
          userRole: esAdmin ? 'admin' : 'user',
          userName: effectiveUser,
          permisos: { peatonal: true, garaje: true },
          diasRestantes: null,
          estaBloqueado: false,
          ultimaPuerta: puertaGuardada || 'peatonal',
          status: 'unpaired',
        });
      }
    } catch (e) {
      LogService.error('Error cargando dispositivo guardado al inicio', e);
      set({ status: 'unpaired' });
    } finally {
      set({ cargando: false });
    }
  },
}));
