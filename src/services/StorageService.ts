import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';

// ==========================================
// 1. LOG SERVICE (Auditoría y Diagnóstico)
// ==========================================

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  extra?: string;
}

type LogListener = (logs: LogEntry[]) => void;
type RemoteForwarder = (level: string, message: string) => void;

class LogServiceClass {
  private logs: LogEntry[] = [];
  private listeners: Set<LogListener> = new Set();
  private remoteForwarder: RemoteForwarder | null = null;
  private fileWritePending = false;
  private nuevosDesdePersistencia = 0;

  setRemoteForwarder(forwarder: RemoteForwarder | null) {
    this.remoteForwarder = forwarder;
  }

  private serializeExtra(extra: any): string {
    if (!extra) return '';
    try {
      const seen = new WeakSet();
      return JSON.stringify(extra, (key, value) => {
        if (value instanceof Error) {
          return { name: value.name, message: value.message, stack: value.stack };
        }
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      }, 2);
    } catch (e) {
      return `[Error al serializar: ${e instanceof Error ? e.message : String(e)}]`;
    }
  }

  private addLog(level: 'info' | 'warn' | 'error', message: string, extra?: any) {
    const timestamp = new Date().toISOString();
    const extraStr = extra ? this.serializeExtra(extra) : '';
    const entry: LogEntry = { timestamp, level, message, extra: extraStr };
    this.logs.unshift(entry);

    if (this.logs.length > 200) this.logs.pop();
    this.listeners.forEach((listener) => listener([...this.logs]));

    if (this.remoteForwarder && (level === 'warn' || level === 'error')) {
      try {
        const trunc = message.length > 80 ? message.substring(0, 80) : message;
        this.remoteForwarder(level.toUpperCase(), trunc);
      } catch {}
    }

    this.nuevosDesdePersistencia++;
    if (this.nuevosDesdePersistencia >= 15 && !this.fileWritePending) {
      this.agendarPersistencia();
    }
  }

  private agendarPersistencia() {
    this.fileWritePending = true;
    setTimeout(() => {
      this.persistirEnArchivo().finally(() => {
        this.fileWritePending = false;
      });
    }, 150);
  }

  async persistirEnArchivo(): Promise<void> {
    try {
      if (!FileSystem.documentDirectory) return;
      const path = FileSystem.documentDirectory + 'plk-logs.json';
      await FileSystem.writeAsStringAsync(path, JSON.stringify(this.logs, null, 2), {
        encoding: FileSystem.EncodingType.UTF8,
      });
      this.nuevosDesdePersistencia = 0;
    } catch {}
  }

  info(message: string, extra?: any) {
    this.addLog('info', message, extra);
    if (__DEV__) console.log(`[INFO] ${message}`, extra ? extra : '');
  }

  warn(message: string, extra?: any) {
    this.addLog('warn', message, extra);
    if (__DEV__) console.warn(`[WARN] ${message}`, extra ? extra : '');
  }

  error(message: string, extra?: any) {
    this.addLog('error', message, extra);
    if (__DEV__) console.error(`[ERROR] ${message}`, extra ? extra : '');
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  async clearLogs(): Promise<void> {
    this.logs = [];
    this.nuevosDesdePersistencia = 0;
    this.listeners.forEach((listener) => listener([]));
    try {
      if (!FileSystem.documentDirectory) return;
      const path = FileSystem.documentDirectory + 'plk-logs.json';
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) {
        await FileSystem.deleteAsync(path, { idempotent: true });
      }
    } catch {}
  }

  subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    listener([...this.logs]);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const LogService = new LogServiceClass();

// ==========================================
// 2. CRYPTO SERVICE (HMAC-SHA256)
// ==========================================

function stringToUtf8ByteArray(str: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let charcode = str.charCodeAt(i);
    if (charcode < 0x80) bytes.push(charcode);
    else if (charcode < 0x800) {
      bytes.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      bytes.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
    } else {
      i++;
      charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      bytes.push(
        0xf0 | (charcode >> 18),
        0x80 | ((charcode >> 12) & 0x3f),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f)
      );
    }
  }
  return new Uint8Array(bytes);
}

function sha256Bytes(data: Uint8Array): Uint8Array {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
  let H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;

  const len = data.length;
  const bitLen = len * 8;
  const paddedLen = Math.ceil((len + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(data);
  padded[len] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);

  const W = new Uint32Array(64);

  for (let chunk = 0; chunk < paddedLen; chunk += 64) {
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(chunk + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = (rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3)) >>> 0;
      const s1 = (rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10)) >>> 0;
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }

    let a = H0, b = H1, c = H2, d = H3, e = H4, f = H5, g = H6, h = H7;

    for (let i = 0; i < 64; i++) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) >>> 0;

      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }

    H0 = (H0 + a) >>> 0; H1 = (H1 + b) >>> 0; H2 = (H2 + c) >>> 0; H3 = (H3 + d) >>> 0;
    H4 = (H4 + e) >>> 0; H5 = (H5 + f) >>> 0; H6 = (H6 + g) >>> 0; H7 = (H7 + h) >>> 0;
  }

  const result = new Uint8Array(32);
  const resView = new DataView(result.buffer);
  resView.setUint32(0, H0, false);
  resView.setUint32(4, H1, false);
  resView.setUint32(8, H2, false);
  resView.setUint32(12, H3, false);
  resView.setUint32(16, H4, false);
  resView.setUint32(20, H5, false);
  resView.setUint32(24, H6, false);
  resView.setUint32(28, H7, false);
  return result;
}

function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

export class CryptoService {
  static hmacSha256(key: string, message: string): string {
    const blockSize = 64;
    let keyBytes = stringToUtf8ByteArray(key);
    if (keyBytes.length > blockSize) keyBytes = sha256Bytes(keyBytes);

    const keyPadded = new Uint8Array(blockSize);
    keyPadded.set(keyBytes);

    const oKeyPad = new Uint8Array(blockSize);
    const iKeyPad = new Uint8Array(blockSize);
    for (let i = 0; i < blockSize; i++) {
      oKeyPad[i] = keyPadded[i] ^ 0x5c;
      iKeyPad[i] = keyPadded[i] ^ 0x36;
    }

    const msgBytes = stringToUtf8ByteArray(message);
    const innerData = new Uint8Array(blockSize + msgBytes.length);
    innerData.set(iKeyPad, 0);
    innerData.set(msgBytes, blockSize);
    const innerHash = sha256Bytes(innerData);

    const outerData = new Uint8Array(blockSize + 32);
    outerData.set(oKeyPad, 0);
    outerData.set(innerHash, blockSize);
    const finalHash = sha256Bytes(outerData);

    let hexResult = '';
    for (let i = 0; i < finalHash.length; i++) {
      hexResult += finalHash[i].toString(16).padStart(2, '0');
    }
    return hexResult;
  }
}

// ==========================================
// 3. BIOMETRIC SERVICE (Huella / FaceID)
// ==========================================

let cachedLocalAuth: typeof import('expo-local-authentication') | null | undefined;

function getLocalAuth(): typeof import('expo-local-authentication') | null {
  if (cachedLocalAuth !== undefined) return cachedLocalAuth;
  try {
    cachedLocalAuth = require('expo-local-authentication');
  } catch {
    cachedLocalAuth = null;
  }
  return cachedLocalAuth ?? null;
}

export interface ResultadoAutenticacionBiometrica {
  exito: boolean;
  cancelado?: boolean;
  mensajeError?: string;
  requiereBuild?: boolean;
}

class BiometricServiceClass {
  async soportaBiometria(): Promise<boolean> {
    const auth = getLocalAuth();
    if (!auth) return false;
    try {
      return await auth.hasHardwareAsync();
    } catch (e: any) {
      LogService.error('Error comprobando soporte biométrico', e);
      return false;
    }
  }

  async tieneBiometriaRegistrada(): Promise<boolean> {
    const auth = getLocalAuth();
    if (!auth) return false;
    try {
      return await auth.isEnrolledAsync();
    } catch (e: any) {
      LogService.error('Error comprobando huellas registradas', e);
      return false;
    }
  }

  async autenticarParaEditarPin(): Promise<ResultadoAutenticacionBiometrica> {
    return this.autenticar(
      'Identificación requerida',
      'Verifica tu huella dactilar para ver y modificar el PIN',
      'Usar código del teléfono'
    );
  }

  async autenticarParaDesbloquearApp(
    subtitulo: string = 'Identifícate para acceder a Pocket Locker'
  ): Promise<ResultadoAutenticacionBiometrica> {
    return this.autenticar(
      'Desbloqueo de Pocket Locker',
      subtitulo,
      'Usar PIN de la app'
    );
  }

  private async autenticar(
    promptMessage: string,
    promptSubtitle: string,
    fallbackLabel: string
  ): Promise<ResultadoAutenticacionBiometrica> {
    try {
      const auth = getLocalAuth();
      if (!auth) return { exito: false, requiereBuild: true, mensajeError: 'Módulo biométrico nativo no disponible.' };

      const soporta = await this.soportaBiometria();
      if (!soporta) return { exito: false, mensajeError: 'Tu dispositivo no cuenta con sensor biométrico activo.' };

      const registrada = await this.tieneBiometriaRegistrada();
      if (!registrada) return { exito: false, mensajeError: 'No tienes ninguna huella dactilar configurada en los Ajustes del móvil.' };

      const res = await auth.authenticateAsync({
        promptMessage,
        promptSubtitle,
        cancelLabel: 'Cancelar',
        fallbackLabel,
        disableDeviceFallback: false,
      });

      if (res.success) return { exito: true };
      if (res.error === 'user_cancel' || res.error === 'app_cancel' || res.error === 'system_cancel') {
        return { exito: false, cancelado: true, mensajeError: 'Autenticación cancelada' };
      }
      return { exito: false, mensajeError: res.warning || 'No se pudo verificar tu huella dactilar.' };
    } catch (e: any) {
      LogService.error('Error durante autenticación biométrica', e);
      return { exito: false, mensajeError: e?.message || 'Error inesperado al solicitar autenticación biométrica.' };
    }
  }
}

export const BiometricService = new BiometricServiceClass();

// ==========================================
// 4. STORAGE SERVICE (Persistencia y PIN)
// ==========================================

const KEYS = {
  DEVICE_MAC: 'deviceMac',
  DEVICE_NAME: 'deviceName',
  DEVICE_TYPE: 'deviceType',
  DEVICE_PIN: 'devicePin_secure',
  ULTIMA_PUERTA: 'ultima_puerta_activa',
  USER_NAME: 'user_name_registrado',
  APP_LOCK_ENABLED: 'app_lock_enabled',
  APP_LOCK_MODE: 'app_lock_mode',
  APP_LOCK_PIN: 'app_lock_pin_secure',
  APP_CUSTOM_NAME: 'app_custom_name',
  APP_CUSTOM_ICON: 'app_custom_icon',
  APP_THEME_MODE: 'app_theme_mode',
  APP_THEME_COLOR: 'app_theme_color',
};

export interface AppLockConfig {
  enabled: boolean;
  mode: 'biometric' | 'pin';
  pin: string;
}

export interface AppCustomPreferences {
  appName: string;
  appIcon: string;
  themeMode: 'light' | 'dark' | 'system';
  themeColor: string;
}

export const DEFAULT_SECURITY_PIN = '2415';

export interface InfoPinParsed {
  esValido: boolean;
  esAdmin: boolean;
  peatonal: boolean;
  garaje: boolean;
  dias: number | null;
  mensajeError?: string;
}

/**
 * Valida y desglosa un código PIN según las especificaciones del sistema Pocket Locker:
 * - Admin: 2415
 * - Usuario: 2S0BPxGxx (primera x: peatonal 0/1, segunda x: garaje 0/1, días opcionales 1-99)
 */
export function parsearYValidarPin(pin?: string | null): InfoPinParsed {
  if (!pin || typeof pin !== 'string') {
    return {
      esValido: false,
      esAdmin: false,
      peatonal: false,
      garaje: false,
      dias: null,
      mensajeError: 'El PIN no puede estar vacío.',
    };
  }
  const p = pin.trim().toUpperCase();
  if (p === DEFAULT_SECURITY_PIN) {
    return {
      esValido: true,
      esAdmin: true,
      peatonal: true,
      garaje: true,
      dias: null,
    };
  }

  const match = p.match(/^2S0BP([01])G([01])(\d{1,2})?$/);
  if (!match) {
    return {
      esValido: false,
      esAdmin: false,
      peatonal: false,
      garaje: false,
      dias: null,
      mensajeError: 'El código debe tener el formato 2S0BPxGxx (ej. 2S0BP1G1 o 2S0BP1G03) o ser 2415.',
    };
  }

  const peatonal = match[1] === '1';
  const garaje = match[2] === '1';
  const diasStr = match[3];
  const dias = diasStr ? parseInt(diasStr, 10) : null;

  if (!peatonal && !garaje) {
    return {
      esValido: false,
      esAdmin: false,
      peatonal: false,
      garaje: false,
      dias: null,
      mensajeError: 'El PIN debe autorizar al menos un acceso (puerta peatonal o garaje).',
    };
  }

  return {
    esValido: true,
    esAdmin: false,
    peatonal,
    garaje,
    dias,
  };
}

export interface DispositivoGuardado {
  mac: string | null;
  name: string | null;
  userName: string | null;
  type: 'classic' | 'ble';
  pin: string;
  role?: 'admin' | 'user';
  permisos?: { peatonal: boolean; garaje: boolean };
  diasRestantes?: number | null;
}

class StorageServiceClass {
  private async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (e) {
      LogService.error(`Error leyendo ${key} desde storage`, e);
      return null;
    }
  }

  private async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      LogService.error(`Error guardando ${key} en storage`, e);
      throw e;
    }
  }

  async getDeviceMac(): Promise<string | null> {
    return this.getItem(KEYS.DEVICE_MAC);
  }

  async getDeviceName(): Promise<string | null> {
    return this.getItem(KEYS.DEVICE_NAME);
  }

  async saveDeviceName(name: string): Promise<void> {
    const limpio = name.trim() || 'Pocket Locker';
    await this.setItem(KEYS.DEVICE_NAME, limpio);
    LogService.info(`Nombre de dispositivo guardado: ${limpio}`);
  }

  async getDeviceType(): Promise<'classic' | 'ble'> {
    const type = await this.getItem(KEYS.DEVICE_TYPE);
    return type === 'ble' ? 'ble' : 'classic';
  }

  async getUserName(): Promise<string | null> {
    const name = await this.getItem(KEYS.USER_NAME);
    return name && name.trim().length > 0 ? name.trim() : null;
  }

  async saveUserName(userName: string): Promise<void> {
    const limpio = userName.trim();
    await this.setItem(KEYS.USER_NAME, limpio);
    LogService.info(`Nombre de usuario guardado: ${limpio}`);
  }

  async getUltimaPuerta(): Promise<'peatonal' | 'garaje'> {
    const puerta = await this.getItem(KEYS.ULTIMA_PUERTA);
    return puerta === 'garaje' ? 'garaje' : 'peatonal';
  }

  async saveUltimaPuerta(puerta: 'peatonal' | 'garaje'): Promise<void> {
    await this.setItem(KEYS.ULTIMA_PUERTA, puerta);
    LogService.info(`Última puerta guardada: ${puerta}`);
  }

  async getAppLockConfig(): Promise<AppLockConfig> {
    try {
      const [enabledVal, modeVal] = await AsyncStorage.multiGet([KEYS.APP_LOCK_ENABLED, KEYS.APP_LOCK_MODE]);
      let pinVal = '';
      try {
        pinVal = (await SecureStore.getItemAsync(KEYS.APP_LOCK_PIN)) || '';
      } catch {
        pinVal = (await AsyncStorage.getItem(KEYS.APP_LOCK_PIN)) || '';
      }
      return {
        enabled: enabledVal[1] === 'true',
        mode: (modeVal[1] === 'biometric' ? 'biometric' : 'pin') as 'biometric' | 'pin',
        pin: pinVal,
      };
    } catch (e) {
      LogService.error('Error leyendo configuración de bloqueo', e);
      return { enabled: false, mode: 'pin', pin: '' };
    }
  }

  async saveAppLockConfig(config: AppLockConfig): Promise<void> {
    try {
      await AsyncStorage.multiSet([
        [KEYS.APP_LOCK_ENABLED, config.enabled ? 'true' : 'false'],
        [KEYS.APP_LOCK_MODE, config.mode],
      ]);
      if (config.pin) {
        try {
          await SecureStore.setItemAsync(KEYS.APP_LOCK_PIN, config.pin);
        } catch {
          await AsyncStorage.setItem(KEYS.APP_LOCK_PIN, config.pin);
        }
      }
      LogService.info('Configuración de bloqueo guardada');
    } catch (e) {
      LogService.error('Error guardando configuración de bloqueo', e);
      throw e;
    }
  }

  async getAppCustomPreferences(): Promise<AppCustomPreferences> {
    try {
      const vals = await AsyncStorage.multiGet([
        KEYS.APP_CUSTOM_NAME,
        KEYS.APP_CUSTOM_ICON,
        KEYS.APP_THEME_MODE,
        KEYS.APP_THEME_COLOR,
      ]);
      return {
        appName: vals[0][1] || 'Pocket Locker',
        appIcon: vals[1][1] || 'clasico',
        themeMode: (vals[2][1] as any) || 'light',
        themeColor: vals[3][1] || 'azul',
      };
    } catch (e) {
      LogService.error('Error leyendo preferencias estéticas', e);
      return { appName: 'Pocket Locker', appIcon: 'clasico', themeMode: 'light', themeColor: 'azul' };
    }
  }

  async saveAppCustomPreferences(prefs: Partial<AppCustomPreferences>): Promise<void> {
    const keyMap: Record<keyof AppCustomPreferences, string> = {
      appName: KEYS.APP_CUSTOM_NAME,
      appIcon: KEYS.APP_CUSTOM_ICON,
      themeMode: KEYS.APP_THEME_MODE,
      themeColor: KEYS.APP_THEME_COLOR,
    };
    const items = (Object.entries(prefs) as [keyof AppCustomPreferences, string][])
      .filter(([k, v]) => v !== undefined && keyMap[k])
      .map(([k, v]) => [keyMap[k], v] as [string, string]);

    if (items.length > 0) {
      await AsyncStorage.multiSet(items).catch((e) => LogService.error('Error guardando preferencias', e));
      LogService.info('Preferencias estéticas de la app guardadas');
    }
  }

  async getDevicePin(): Promise<string> {
    try {
      const securePin = await SecureStore.getItemAsync(KEYS.DEVICE_PIN);
      if (securePin && securePin.trim().length > 0) return securePin.trim();

      const fallbackPin = await AsyncStorage.getItem(KEYS.DEVICE_PIN);
      if (fallbackPin && fallbackPin.trim().length > 0) return fallbackPin.trim();

      return DEFAULT_SECURITY_PIN;
    } catch (e) {
      try {
        const pin = await AsyncStorage.getItem(KEYS.DEVICE_PIN);
        return pin && pin.trim().length > 0 ? pin.trim() : DEFAULT_SECURITY_PIN;
      } catch {
        return DEFAULT_SECURITY_PIN;
      }
    }
  }

  async saveDevicePin(pin: string): Promise<void> {
    const pinLimpio = pin.trim() || DEFAULT_SECURITY_PIN;
    try {
      await SecureStore.setItemAsync(KEYS.DEVICE_PIN, pinLimpio, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      await AsyncStorage.setItem(KEYS.DEVICE_PIN, pinLimpio);
      LogService.info('PIN de seguridad guardado en SecureStore');
    } catch (e) {
      LogService.warn('SecureStore falló, guardando en AsyncStorage como fallback', e);
      await AsyncStorage.setItem(KEYS.DEVICE_PIN, pinLimpio);
    }
  }

  async saveDevice(
    mac: string,
    name: string,
    type: 'classic' | 'ble' = 'classic',
    pin: string = DEFAULT_SECURITY_PIN,
    userName: string = 'Usuario'
  ): Promise<void> {
    try {
      await AsyncStorage.multiSet([
        [KEYS.DEVICE_MAC, mac],
        [KEYS.DEVICE_NAME, name],
        [KEYS.DEVICE_TYPE, type],
        [KEYS.USER_NAME, userName],
      ]);
      await this.saveDevicePin(pin);
      LogService.info(`Dispositivo guardado: ${name} (${mac})`);
    } catch (e) {
      LogService.error('Error guardando dispositivo en storage', e);
      throw e;
    }
  }

  async clearDevice(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        KEYS.DEVICE_MAC,
        KEYS.DEVICE_NAME,
        KEYS.DEVICE_TYPE,
        KEYS.DEVICE_PIN,
        KEYS.ULTIMA_PUERTA,
        KEYS.USER_NAME,
      ]);
      try {
        await SecureStore.deleteItemAsync(KEYS.DEVICE_PIN);
      } catch {}
      LogService.info('Dispositivo y credenciales eliminados');
    } catch (e) {
      LogService.error('Error eliminando dispositivo de storage', e);
      throw e;
    }
  }

  async obtenerDispositivo(): Promise<DispositivoGuardado> {
    try {
      const resultados = await AsyncStorage.multiGet([
        KEYS.DEVICE_MAC,
        KEYS.DEVICE_NAME,
        KEYS.DEVICE_TYPE,
        KEYS.USER_NAME,
      ]);
      const mapa = Object.fromEntries(resultados);
      const pin = await this.getDevicePin();
      const parsed = parsearYValidarPin(pin);

      return {
        mac: mapa[KEYS.DEVICE_MAC] || null,
        name: mapa[KEYS.DEVICE_NAME] || null,
        userName: mapa[KEYS.USER_NAME] || null,
        type: (mapa[KEYS.DEVICE_TYPE] === 'ble' ? 'ble' : 'classic') as 'classic' | 'ble',
        pin: pin || DEFAULT_SECURITY_PIN,
        role: parsed.esAdmin ? 'admin' : 'user',
        permisos: { peatonal: parsed.peatonal, garaje: parsed.garaje },
        diasRestantes: parsed.dias,
      };
    } catch (e) {
      LogService.error('Error leyendo dispositivo desde storage', e);
      return {
        mac: null,
        name: null,
        userName: null,
        type: 'classic',
        pin: DEFAULT_SECURITY_PIN,
        role: 'user',
        permisos: { peatonal: true, garaje: true },
        diasRestantes: null,
      };
    }
  }
}

export const StorageService = new StorageServiceClass();
export default StorageService;
