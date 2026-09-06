import AsyncStorage from "@react-native-async-storage/async-storage"
import * as SecureStore from "expo-secure-store"
import LogService from "./LogService"

/**
 * Claves utilizadas para la persistencia local en AsyncStorage y SecureStore.
 */
const KEYS = {
    DEVICE_MAC: "deviceMac",
    DEVICE_NAME: "deviceName",
    DEVICE_TYPE: "deviceType",
    DEVICE_PIN: "devicePin_secure",
    ULTIMA_PUERTA: "ultima_puerta_activa",
    USER_NAME: "user_name_registrado",
    USER_ROLE: "user_role_permiso",
    USER_PERMISSIONS: "user_permisos_puertas",
    DIAS_RESTANTES: "user_dias_restantes",
    ESTA_BLOQUEADO: "user_esta_bloqueado",
}

/**
 * PIN de seguridad por defecto / Administrador para el firmware ESP32 Pocket Locker.
 */
export const DEFAULT_SECURITY_PIN = "2415"

/**
 * Resultado estructurado de la validación y parseo del PIN de seguridad.
 */
export interface InfoPinParsed {
    esValido: boolean
    esAdmin: boolean
    peatonal: boolean
    garaje: boolean
    dias: number | null
    mensajeError?: string
}

/**
 * Valida y desglosa un código PIN según las especificaciones del sistema Pocket Locker:
 * - Admin: 2415
 * - Usuario: 2S0BPxGxx (primera x: peatonal 0/1, segunda x: garaje 0/1, días opcionales 1-99)
 */
export function parsearYValidarPin(pin?: string | null): InfoPinParsed {
    if (!pin || typeof pin !== "string") {
        return {
            esValido: false,
            esAdmin: false,
            peatonal: false,
            garaje: false,
            dias: null,
            mensajeError: "El PIN no puede estar vacío.",
        }
    }
    const p = pin.trim().toUpperCase()
    if (p === DEFAULT_SECURITY_PIN) {
        return {
            esValido: true,
            esAdmin: true,
            peatonal: true,
            garaje: true,
            dias: null,
        }
    }

    const match = p.match(/^2S0BP([01])G([01])(\d{1,2})?$/)
    if (!match) {
        return {
            esValido: false,
            esAdmin: false,
            peatonal: false,
            garaje: false,
            dias: null,
            mensajeError: "El código debe tener el formato 2S0BPxGxx (ej. 2S0BP1G1 o 2S0BP1G03) o ser 2415.",
        }
    }

    const peatonal = match[1] === "1"
    const garaje = match[2] === "1"
    const diasStr = match[3]
    const dias = diasStr ? parseInt(diasStr, 10) : null

    if (!peatonal && !garaje) {
        return {
            esValido: false,
            esAdmin: false,
            peatonal: false,
            garaje: false,
            dias: null,
            mensajeError: "El PIN debe autorizar al menos un acceso (puerta peatonal o garaje).",
        }
    }

    return {
        esValido: true,
        esAdmin: false,
        peatonal,
        garaje,
        dias,
    }
}

/**
 * Estructura de datos completa de un dispositivo Pocket Locker persistido.
 */
export interface DispositivoGuardado {
    mac: string | null
    name: string | null
    userName: string | null
    type: "classic" | "ble"
    pin: string
    role: "admin" | "user"
    permisos: { peatonal: boolean; garaje: boolean }
    diasRestantes: number | null
    estaBloqueado: boolean
}

/**
 * Servicio encargado de gestionar la persistencia local de configuración,
 * credenciales y datos del dispositivo Pocket Locker emparejado.
 *
 * Utiliza almacenamiento seguro mediante Hardware Keystore (Android Keystore / iOS Keychain)
 * para los secretos y credenciales (PIN), y AsyncStorage para metadatos públicos (MAC, nombre).
 */
class StorageServiceClass {
    /**
     * Obtiene la dirección MAC o UUID del dispositivo guardado.
     */
    async getDeviceMac(): Promise<string | null> {
        try {
            return await AsyncStorage.getItem(KEYS.DEVICE_MAC)
        } catch (e) {
            LogService.error("Error leyendo deviceMac desde storage", e)
            return null
        }
    }

    /**
     * Obtiene el nombre personalizado asignado al dispositivo.
     */
    async getDeviceName(): Promise<string | null> {
        try {
            return await AsyncStorage.getItem(KEYS.DEVICE_NAME)
        } catch (e) {
            LogService.error("Error leyendo deviceName desde storage", e)
            return null
        }
    }

    /**
     * Obtiene el tipo de conexión Bluetooth configurada ('classic' o 'ble').
     */
    async getDeviceType(): Promise<"classic" | "ble"> {
        try {
            const type = await AsyncStorage.getItem(KEYS.DEVICE_TYPE)
            return (type === "ble" ? "ble" : "classic") as "classic" | "ble"
        } catch (e) {
            LogService.error("Error leyendo deviceType desde storage", e)
            return "classic"
        }
    }

    /**
     * Obtiene el PIN o clave de seguridad guardada en el enclave seguro (SecureStore).
     */
    async getDevicePin(): Promise<string> {
        try {
            // Intentar leer desde SecureStore (Hardware Keystore)
            const securePin = await SecureStore.getItemAsync(KEYS.DEVICE_PIN)
            if (securePin && securePin.trim().length > 0) {
                return securePin.trim()
            }

            // Fallback a AsyncStorage para migración o entornos sin hardware seguro
            const fallbackPin = await AsyncStorage.getItem(KEYS.DEVICE_PIN)
            if (fallbackPin && fallbackPin.trim().length > 0) {
                return fallbackPin.trim()
            }

            return DEFAULT_SECURITY_PIN
        } catch (e) {
            LogService.warn("SecureStore no disponible, usando fallback AsyncStorage para PIN", e)
            try {
                const pin = await AsyncStorage.getItem(KEYS.DEVICE_PIN)
                return pin && pin.trim().length > 0 ? pin.trim() : DEFAULT_SECURITY_PIN
            } catch {
                return DEFAULT_SECURITY_PIN
            }
        }
    }

    /**
     * Guarda o actualiza el PIN de seguridad en el enclave seguro (SecureStore).
     */
    async saveDevicePin(pin: string): Promise<void> {
        const pinLimpio = pin.trim() || DEFAULT_SECURITY_PIN
        try {
            await SecureStore.setItemAsync(KEYS.DEVICE_PIN, pinLimpio, {
                keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
            })
            // Mantener copia sincronizada
            await AsyncStorage.setItem(KEYS.DEVICE_PIN, pinLimpio)
            LogService.info("PIN de seguridad guardado en SecureStore (Hardware Keystore)")
        } catch (e) {
            LogService.warn("SecureStore falló, guardando en AsyncStorage como fallback", e)
            await AsyncStorage.setItem(KEYS.DEVICE_PIN, pinLimpio)
        }
    }

    /**
     * Obtiene el nombre del usuario registrado previamente en el dispositivo.
     */
    async getUserName(): Promise<string | null> {
        try {
            const name = await AsyncStorage.getItem(KEYS.USER_NAME)
            return name && name.trim().length > 0 ? name.trim() : null
        } catch {
            return null
        }
    }

    /**
     * Guarda o actualiza el nombre del usuario en el almacenamiento local.
     */
    async saveUserName(userName: string): Promise<void> {
        try {
            const limpio = userName.trim()
            await AsyncStorage.setItem(KEYS.USER_NAME, limpio)
            LogService.info(`Nombre de usuario guardado: ${limpio}`)
        } catch (e) {
            LogService.error("Error guardando nombre de usuario", e)
        }
    }

    /**
     * Guarda los datos principales de vinculación de un dispositivo junto a los datos de usuario.
     */
    async saveDevice(
        mac: string,
        name: string,
        type: "classic" | "ble" = "classic",
        pin: string = DEFAULT_SECURITY_PIN,
        userName: string = "Usuario"
    ): Promise<void> {
        try {
            const parsed = parsearYValidarPin(pin)
            // Solo el usuario '2415' es administrador. Ningún otro usuario es administrador.
            const role = userName === "2415" ? "admin" : "user"
            const permisos = { peatonal: parsed.peatonal, garaje: parsed.garaje }
            const diasRestantes = parsed.dias

            await AsyncStorage.multiSet([
                [KEYS.DEVICE_MAC, mac],
                [KEYS.DEVICE_NAME, name],
                [KEYS.DEVICE_TYPE, type],
                [KEYS.USER_NAME, userName],
                [KEYS.USER_ROLE, role],
                [KEYS.USER_PERMISSIONS, JSON.stringify(permisos)],
                [KEYS.DIAS_RESTANTES, diasRestantes !== null ? diasRestantes.toString() : ""],
                [KEYS.ESTA_BLOQUEADO, "false"],
            ])
            await this.saveDevicePin(pin)
            LogService.info(`Dispositivo guardado en storage: ${name} (${mac}) usuario: ${userName} rol: ${role}`)
        } catch (e) {
            LogService.error("Error guardando dispositivo en storage", e)
            throw e
        }
    }

    /**
     * Actualiza el estado sincronizado de usuario desde el ESP32 (días restantes, bloqueo, permisos).
     */
    async updateUserStatus(
        diasRestantes: number | null,
        estaBloqueado: boolean,
        permisos?: { peatonal: boolean; garaje: boolean }
    ): Promise<void> {
        try {
            const items: [string, string][] = [
                [KEYS.DIAS_RESTANTES, diasRestantes !== null ? diasRestantes.toString() : ""],
                [KEYS.ESTA_BLOQUEADO, estaBloqueado ? "true" : "false"],
            ]
            if (permisos) {
                items.push([KEYS.USER_PERMISSIONS, JSON.stringify(permisos)])
            }
            await AsyncStorage.multiSet(items)
            LogService.info(`Estado de usuario sincronizado: bloqueado=${estaBloqueado}, dias=${diasRestantes}`)
        } catch (e) {
            LogService.error("Error actualizando estado de usuario en storage", e)
        }
    }

    /**
     * Elimina completamente la configuración del dispositivo y el PIN seguro.
     */
    async clearDevice(): Promise<void> {
        try {
            await AsyncStorage.multiRemove([
                KEYS.DEVICE_MAC,
                KEYS.DEVICE_NAME,
                KEYS.DEVICE_TYPE,
                KEYS.DEVICE_PIN,
                KEYS.ULTIMA_PUERTA,
                KEYS.USER_NAME,
                KEYS.USER_ROLE,
                KEYS.USER_PERMISSIONS,
                KEYS.DIAS_RESTANTES,
                KEYS.ESTA_BLOQUEADO,
            ])
            try {
                await SecureStore.deleteItemAsync(KEYS.DEVICE_PIN)
            } catch {
                // Ignorar si SecureStore ya estaba vacío
            }
            LogService.info("Dispositivo y credenciales eliminados de storage seguro")
        } catch (e) {
            LogService.error("Error eliminando dispositivo de storage", e)
            throw e
        }
    }

    /**
     * Obtiene la última puerta/pantalla utilizada ('peatonal' | 'garaje') desde almacenamiento no volátil.
     * Permite que la pantalla ControlScreen se inicialice directamente en la puerta correspondiente
     * de forma síncrona y sin parpadeos visuales (anti-flicker).
     * Por defecto retorna 'peatonal' si es la primera sesión.
     */
    async getUltimaPuerta(): Promise<"peatonal" | "garaje"> {
        try {
            const puerta = await AsyncStorage.getItem(KEYS.ULTIMA_PUERTA)
            return puerta === "garaje" ? "garaje" : "peatonal"
        } catch (e) {
            LogService.error("Error leyendo ultimaPuerta desde storage", e)
            return "peatonal"
        }
    }

    /**
     * Guarda la última puerta seleccionada o accionada ('peatonal' | 'garaje') en AsyncStorage.
     */
    async saveUltimaPuerta(puerta: "peatonal" | "garaje"): Promise<void> {
        try {
            await AsyncStorage.setItem(KEYS.ULTIMA_PUERTA, puerta)
            LogService.info(`Última puerta guardada en storage: ${puerta}`)
        } catch (e) {
            LogService.error("Error guardando ultimaPuerta en storage", e)
        }
    }

    /**
     * Lee en una sola operación los metadatos y el PIN de seguridad.
     */
    async obtenerDispositivo(): Promise<DispositivoGuardado> {
        try {
            const resultados = await AsyncStorage.multiGet([
                KEYS.DEVICE_MAC,
                KEYS.DEVICE_NAME,
                KEYS.DEVICE_TYPE,
                KEYS.USER_NAME,
                KEYS.USER_ROLE,
                KEYS.USER_PERMISSIONS,
                KEYS.DIAS_RESTANTES,
                KEYS.ESTA_BLOQUEADO,
            ])
            const mapa = Object.fromEntries(resultados)
            const pin = await this.getDevicePin()
            const parsed = parsearYValidarPin(pin)

            let permisos = { peatonal: parsed.peatonal, garaje: parsed.garaje }
            const permsRaw = mapa[KEYS.USER_PERMISSIONS]
            if (permsRaw) {
                try {
                    permisos = JSON.parse(permsRaw)
                } catch {
                    // Fallback a parsed
                }
            }

            const diasRaw = mapa[KEYS.DIAS_RESTANTES]
            const diasRestantes = diasRaw && diasRaw.length > 0 ? parseInt(diasRaw, 10) : parsed.dias
            const savedUserName = mapa[KEYS.USER_NAME] || null
            const esAdmin = savedUserName === "2415"

            return {
                mac: mapa[KEYS.DEVICE_MAC] || null,
                name: mapa[KEYS.DEVICE_NAME] || null,
                userName: savedUserName,
                type: (mapa[KEYS.DEVICE_TYPE] === "ble" ? "ble" : "classic") as "classic" | "ble",
                pin: pin || DEFAULT_SECURITY_PIN,
                role: esAdmin ? "admin" : "user",
                permisos,
                diasRestantes: isNaN(diasRestantes as number) ? null : diasRestantes,
                estaBloqueado: mapa[KEYS.ESTA_BLOQUEADO] === "true",
            }
        } catch (e) {
            LogService.error("Error leyendo dispositivo desde storage", e)
            return {
                mac: null,
                name: null,
                userName: null,
                type: "classic",
                pin: DEFAULT_SECURITY_PIN,
                role: "user",
                permisos: { peatonal: true, garaje: true },
                diasRestantes: null,
                estaBloqueado: false,
            }
        }
    }
}

const StorageService = new StorageServiceClass()
export default StorageService
