/**
 * Tipos y definiciones de estado global de la aplicación (Zustand).
 */

export interface UsuarioAdmin {
  mac: string;
  nombre: string;
  peatonal: boolean;
  garaje: boolean;
  diasRestantes: number;
  bloqueado: boolean;
}

export type BluetoothStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'unauthorized'
  | 'disabled'
  | 'unpaired';

export interface PocketState {
  status: BluetoothStatus;
  deviceName: string | null;
  deviceMac: string | null;
  deviceType: 'classic' | 'ble';
  devicePin: string;
  cargando: boolean;
  tiempoRestanteBloqueo: number;
  ultimaPuerta: 'peatonal' | 'garaje';
  userRole: 'admin' | 'user';
  userName: string | null;
  permisos: { peatonal: boolean; garaje: boolean };
  diasRestantes: number | null;
  estaBloqueado: boolean;
  isDemoMode: boolean;
  mockUsuariosAdmin: UsuarioAdmin[];
}

export interface PocketActions {
  iniciarBloqueoMargen: (segundos?: number) => void;
  guardarUltimaPuerta: (puerta: 'peatonal' | 'garaje') => Promise<void>;
  activarModoDemo: () => Promise<void>;
  desactivarModoDemo: () => Promise<void>;
  guardarNombreUsuario: (nombre: string) => Promise<void>;
  conectar: () => Promise<void>;
  conectarDispositivo: (macAddress: string, type?: 'classic' | 'ble') => Promise<void>;
  desconectar: () => Promise<void>;
  enviarComando: (comando: string) => Promise<void>;
  sincronizarConLocker: () => Promise<void>;
  obtenerListaUsuarios: () => Promise<UsuarioAdmin[]>;
  desbloquearUsuario: (mac: string) => Promise<boolean>;
  modificarUsuario: (mac: string, dias: number, peatonal: boolean, garaje: boolean) => Promise<boolean>;
  eliminarUsuario: (mac: string) => Promise<boolean>;
  actualizarDispositivoVinculado: (
    mac: string,
    name: string,
    type?: 'classic' | 'ble',
    pin?: string,
    userName?: string
  ) => Promise<void>;
  actualizarPinDispositivo: (nuevoPin: string) => Promise<void>;
  desvincularDispositivo: () => Promise<void>;
  renombrarDispositivo: (nuevoNombre: string) => Promise<void>;
  inicializar: () => Promise<void>;
  resetStore: () => void;
  setStatus: (status: BluetoothStatus) => void;
  setCargando: (cargando: boolean) => void;
}

export type PocketStore = PocketState & PocketActions;
