import RNBluetoothClassic, { BluetoothDevice } from "react-native-bluetooth-classic"
import { BleManager, Device } from "react-native-ble-plx"
import { PermissionsAndroid, Platform, NativeModules, Linking } from "react-native"
import LogService from "./LogService"

/**
 * Representación unificada de un dispositivo Bluetooth detectado (Clásico o BLE).
 */
export interface DispositivoBT {
    name: string
    address: string
    type: "classic" | "ble"
}

/**
 * Servicio centralizado para la gestión de comunicaciones Bluetooth.
 * Soporta de forma transparente:
 * - Bluetooth Clásico (RFCOMM / SPP) mediante react-native-bluetooth-classic.
 * - Bluetooth Low Energy (GATT / BLE) mediante react-native-ble-plx.
 */
class BluetoothServiceClass {
    private bleManager: BleManager | null = null
    private dispositivoConectadoClassic: BluetoothDevice | null = null
    private dispositivoConectadoBle: Device | null = null
    private onDesconexionCallback: (() => void) | null = null
    private onDatosRecibidosCallback: ((data: string) => void) | null = null
    private disconnectSubscription: any = null
    private classicDisconnectSubscription: any = null
    private dataSubscription: any = null
    private bleScanTimeout: NodeJS.Timeout | null = null

    /**
     * Comprueba de manera segura si el módulo nativo de Bluetooth Clásico está vinculado en la plataforma.
     */
    private esClassicDisponible(): boolean {
        try {
            return !!NativeModules.RNBluetoothClassic
        } catch {
            return false
        }
    }

    /**
     * Registra una función de retorno (callback) que se invocará cuando el dispositivo
     * conectado se desconecte de forma inesperada. Retorna función de desuscripción.
     */
    registrarOnDesconexion(callback: () => void): () => void {
        this.onDesconexionCallback = callback
        return () => {
            if (this.onDesconexionCallback === callback) {
                this.onDesconexionCallback = null
            }
        }
    }

    /**
     * Registra un callback para recibir telemetría y respuestas estructuradas del locker. Retorna función de desuscripción.
     */
    registrarOnDatosRecibidos(callback: (data: string) => void): () => void {
        this.onDatosRecibidosCallback = callback
        return () => {
            if (this.onDatosRecibidosCallback === callback) {
                this.onDatosRecibidosCallback = null
            }
        }
    }

    /**
     * Notifica a los suscriptores la recepción de una nueva línea de telemetría.
     */
    private notificarDatosRecibidos(data: string) {
        const dataLimpia = data.trim()
        if (dataLimpia.length > 0 && this.onDatosRecibidosCallback) {
            this.onDatosRecibidosCallback(dataLimpia)
        }
    }

    /**
     * Configura la escucha activa de eventos de desconexión física para el dispositivo BLE conectado.
     */
    private registrarMonitoreoDesconexion(device: Device) {
        if (this.disconnectSubscription) {
            try {
                this.disconnectSubscription.remove()
            } catch (e) {
                // Ignorar posibles errores al limpiar suscripciones previas
            }
        }

        const manager = this.getBleManager()
        if (!manager) return

        this.disconnectSubscription = manager.onDeviceDisconnected(device.id, (error, disconnectedDevice) => {
            LogService.info(`[BLE] Dispositivo desconectado activamente: ${disconnectedDevice?.id || ""}`)
            if (this.onDesconexionCallback) {
                this.onDesconexionCallback()
            }
            this.dispositivoConectadoBle = null
        })
    }

    /**
     * Configura la escucha activa de desconexión física para el dispositivo Bluetooth Clásico.
     */
    private registrarMonitoreoDesconexionClassic(device: BluetoothDevice, address: string) {
        if (this.classicDisconnectSubscription) {
            try {
                this.classicDisconnectSubscription.remove()
            } catch (e) {
                // Ignorar
            }
            this.classicDisconnectSubscription = null
        }

        if (device && typeof (device as any).onDisconnected === "function") {
            try {
                this.classicDisconnectSubscription = (device as any).onDisconnected(() => {
                    LogService.info(`[Classic] Dispositivo desconectado físicamente: ${address}`)
                    if (this.onDesconexionCallback) {
                        this.onDesconexionCallback()
                    }
                    this.dispositivoConectadoClassic = null
                })
            } catch (e) {
                LogService.warn("Error al registrar listener de desconexión en device Classic", e)
            }
        } else if (
            this.esClassicDisponible() &&
            typeof (RNBluetoothClassic as any).onDeviceDisconnected === "function"
        ) {
            try {
                this.classicDisconnectSubscription = (RNBluetoothClassic as any).onDeviceDisconnected(
                    (event: { address?: string }) => {
                        if (event && event.address && event.address.toLowerCase() === address.toLowerCase()) {
                            LogService.info(`[Classic] Evento nativo de desconexión recibido para: ${event.address}`)
                            if (this.onDesconexionCallback) {
                                this.onDesconexionCallback()
                            }
                            this.dispositivoConectadoClassic = null
                        }
                    }
                )
            } catch (e) {
                LogService.warn("Error registrando listener global de desconexión Classic", e)
            }
        }

        // Registrar escucha activa de lectura entrante (telemetría)
        if (this.dataSubscription) {
            try {
                this.dataSubscription.remove()
            } catch (e) {
                // Ignorar
            }
            this.dataSubscription = null
        }

        if (device && typeof (device as any).onDataReceived === "function") {
            try {
                this.dataSubscription = (device as any).onDataReceived((event: { data: string }) => {
                    if (event && event.data) {
                        this.notificarDatosRecibidos(event.data)
                    }
                })
            } catch (e) {
                LogService.warn("Error al registrar listener de datos en device Classic", e)
            }
        } else if (this.esClassicDisponible() && typeof (RNBluetoothClassic as any).onDeviceRead === "function") {
            try {
                this.dataSubscription = (RNBluetoothClassic as any).onDeviceRead(
                    address,
                    (event: { data?: string }) => {
                        if (event && event.data) {
                            this.notificarDatosRecibidos(event.data)
                        }
                    }
                )
            } catch (e) {
                LogService.warn("Error al registrar onDeviceRead global", e)
            }
        }
    }

    /**
     * Obtiene o instancia el manejador BleManager de forma perezosa (Lazy Initialization)
     * para evitar sobrecoste en el arranque.
     */
    private getBleManager(): BleManager | null {
        try {
            if (!this.bleManager) {
                this.bleManager = new BleManager()
            }
            return this.bleManager
        } catch (e) {
            LogService.warn("[BLE] El módulo react-native-ble-plx no está disponible en este entorno", e)
            return null
        }
    }

    /**
     * Solicita al usuario los permisos de sistema requeridos en Android (incluyendo Android 12+ API 31+).
     * Comprueba previamente si ya han sido concedidos para no interrumpir el flujo ni abrir diálogos redundantes.
     */
    async solicitarPermisos(): Promise<boolean> {
        if (Platform.OS !== "android") return true

        try {
            const apiLevel =
                typeof Platform.Version === "number" ? Platform.Version : parseInt(String(Platform.Version), 10)

            if (apiLevel >= 31) {
                // Verificar primero si ya están otorgados para evitar saltos de pantalla o re-peticiones
                const hasScan = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN)
                const hasConnect = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT)
                if (hasScan && hasConnect) {
                    return true
                }

                // Android 12+ requiere BLUETOOTH_SCAN y BLUETOOTH_CONNECT en tiempo de ejecución
                const granted = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                ])

                return (
                    granted["android.permission.BLUETOOTH_SCAN"] === PermissionsAndroid.RESULTS.GRANTED &&
                    granted["android.permission.BLUETOOTH_CONNECT"] === PermissionsAndroid.RESULTS.GRANTED
                )
            } else {
                // Versiones anteriores a Android 12: verificar primero ACCESS_FINE_LOCATION
                const hasLocation = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)
                if (hasLocation) {
                    return true
                }

                const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)
                return granted === PermissionsAndroid.RESULTS.GRANTED
            }
        } catch (e) {
            LogService.warn("Error solicitando permisos Bluetooth en el dispositivo", e)
            return false
        }
    }

    /**
     * Determina si el hardware del teléfono admite conectividad Bluetooth (Clásico o BLE).
     */
    async esSoportado(): Promise<boolean> {
        if (this.getBleManager() !== null) {
            return true
        }
        if (this.esClassicDisponible()) {
            try {
                return await RNBluetoothClassic.isBluetoothAvailable()
            } catch (e) {
                return false
            }
        }
        return false
    }

    /**
     * Comprueba si el adaptador Bluetooth del teléfono está actualmente encendido.
     */
    async estaEncendido(): Promise<boolean> {
        try {
            if (this.esClassicDisponible()) {
                try {
                    const activeClassic = await RNBluetoothClassic.isBluetoothEnabled()
                    if (activeClassic) return true
                } catch (e) {
                    // Continuar con verificación BLE
                }
            }

            const manager = this.getBleManager()
            if (manager) {
                try {
                    const state = await manager.state()
                    return state === "PoweredOn"
                } catch (e) {
                    return false
                }
            }
            return false
        } catch (e) {
            LogService.warn("Error comprobando si Bluetooth está encendido:", e)
            return false
        }
    }

    /**
     * Solicita al sistema operativo habilitar el adaptador Bluetooth si está apagado.
     * Si ya está encendido, retorna inmediatamente true sin diálogos del sistema.
     * Espera a que el adaptador complete la transición a encendido (STATE_ON).
     */
    async pedirActivar(): Promise<boolean> {
        try {
            const yaActivo = await this.estaEncendido()
            if (yaActivo) return true

            await this.solicitarPermisos()
            if (this.esClassicDisponible()) {
                const requested = await RNBluetoothClassic.requestBluetoothEnabled()
                if (requested) {
                    // Esperar activamente a que el adaptador complete la transición a encendido
                    for (let i = 0; i < 10; i++) {
                        await new Promise((r) => setTimeout(r, 250))
                        const yaEncendido = await this.estaEncendido()
                        if (yaEncendido) return true
                    }
                    return true
                }
                return false
            }
            return false
        } catch (e) {
            LogService.warn("Error al solicitar activar Bluetooth:", e)
            return false
        }
    }

    /**
     * Vincula activamente un dispositivo Bluetooth desde la aplicación,
     * se haya emparejado previamente en los ajustes del sistema o no.
     */
    async vincularDispositivo(address: string): Promise<boolean> {
        if (!this.esClassicDisponible()) return false
        try {
            await this.cancelarDescubrimiento()
            await new Promise((r) => setTimeout(r, 200))

            // Verificar si ya está emparejado en el sistema operativo Android
            try {
                const emparejados = await RNBluetoothClassic.getBondedDevices()
                if (
                    Array.isArray(emparejados) &&
                    emparejados.some((d: any) => d && d.address && d.address.toLowerCase() === address.toLowerCase())
                ) {
                    LogService.info(`[Classic] El dispositivo ${address} ya está emparejado en el sistema`)
                    return true
                }
            } catch (eBond) {
                LogService.warn("[Classic] Aviso al consultar dispositivos emparejados:", eBond)
            }

            LogService.info(`[Classic] Vinculando dispositivo desde la app: ${address}`)
            const pairPromise = RNBluetoothClassic.pairDevice(address)
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Tiempo de espera agotado al emparejar")), 4000)
            )
            await Promise.race([pairPromise, timeoutPromise])
            LogService.info(`[Classic] Dispositivo vinculado con éxito: ${address}`)
            return true
        } catch (e) {
            LogService.warn(`[Classic] Aviso al vincular ${address} (continuando flujo):`, e)
            return false
        }
    }

    /**
     * Descubre activamente los dispositivos Bluetooth que se encuentran actualmente accesibles en el entorno de radio.
     * Solo retorna dispositivos detectados en tiempo real (o actualmente conectados al teléfono).
     * No incluye dispositivos guardados/emparejados en el historial del teléfono que estén fuera de alcance.
     *
     * @param onDispositivoEncontrado Callback opcional para emitir dispositivos reactivamente en cuanto son detectados
     * @param duracionMs Duración del escaneo activo (por defecto 6000ms para una detección rápida y confiable)
     */
    async listarDispositivos(
        onDispositivoEncontrado?: (dispositivo: DispositivoBT) => void,
        duracionMs: number = 6000
    ): Promise<DispositivoBT[]> {
        const okPermisos = await this.solicitarPermisos()
        if (!okPermisos) {
            throw new Error("Permisos de Bluetooth no concedidos")
        }

        // Cancelar escaneos residuales previos y esperar estabilización del chip
        await this.cancelarDescubrimiento()
        await new Promise((r) => setTimeout(r, 300))

        const mapaDispositivos = new Map<string, DispositivoBT>()

        const emitirOActualizar = (dev: DispositivoBT) => {
            const addr = dev.address.toLowerCase()
            const prev = mapaDispositivos.get(addr)
            if (prev) {
                if (
                    (!prev.name || prev.name === "Sin nombre" || prev.name.startsWith("Desconocido")) &&
                    dev.name &&
                    dev.name !== "Sin nombre"
                ) {
                    prev.name = dev.name
                    onDispositivoEncontrado?.(prev)
                }
                return
            }
            mapaDispositivos.set(addr, dev)
            onDispositivoEncontrado?.(dev)
        }

        // 1. Si hay algún dispositivo Bluetooth actualmente conectado al teléfono, añadirlo (está al alcance físico)
        if (this.esClassicDisponible()) {
            try {
                const conectados = await RNBluetoothClassic.getConnectedDevices()
                if (Array.isArray(conectados)) {
                    for (const c of conectados) {
                        if (c && c.address) {
                            emitirOActualizar({
                                name: c.name || "Sin nombre",
                                address: c.address,
                                type: "classic",
                            })
                        }
                    }
                }
            } catch (e) {
                LogService.warn("[Bluetooth] Error al consultar dispositivos conectados clásicos:", e)
            }

            // 1.5. Consultar dispositivos ya emparejados en el sistema (detección inmediata de PLBT)
            try {
                const emparejados = await RNBluetoothClassic.getBondedDevices()
                if (Array.isArray(emparejados)) {
                    for (const b of emparejados) {
                        if (b && b.address) {
                            const nameUpper = (b.name || "").toUpperCase()
                            if (nameUpper.includes("PLBT") || nameUpper.includes("POCKET LOCKER") || nameUpper.includes("ESP32")) {
                                emitirOActualizar({
                                    name: b.name || "PLBT",
                                    address: b.address,
                                    type: "classic",
                                })
                            }
                        }
                    }
                }
            } catch (e) {
                LogService.warn("[Bluetooth] Error al consultar dispositivos emparejados clásicos:", e)
            }
        }

        // 2. Iniciar descubrimiento activo de Bluetooth Clásico (inquiry scan en tiempo real)
        let subscripcionClassic: any = null
        let classicPromise: Promise<any> = Promise.resolve([])

        if (this.esClassicDisponible()) {
            try {
                if (typeof (RNBluetoothClassic as any).onDeviceDiscovered === "function") {
                    subscripcionClassic = (RNBluetoothClassic as any).onDeviceDiscovered((event: any) => {
                        const dev = event?.device
                        if (dev && dev.address) {
                            emitirOActualizar({
                                name: dev.name || "Sin nombre",
                                address: dev.address,
                                type: "classic",
                            })
                        }
                    })
                }

                classicPromise = RNBluetoothClassic.startDiscovery()
                    .then((encontrados) => {
                        if (Array.isArray(encontrados)) {
                            for (const d of encontrados) {
                                if (d && d.address) {
                                    emitirOActualizar({
                                        name: d.name || "Sin nombre",
                                        address: d.address,
                                        type: "classic",
                                    })
                                }
                            }
                        }
                        return encontrados
                    })
                    .catch((err) => {
                        LogService.warn("[Bluetooth] Aviso en startDiscovery clásico:", err)
                        return []
                    })
            } catch (err) {
                LogService.warn("[Bluetooth] Error iniciando startDiscovery clásico:", err)
            }
        }

        // 3. Iniciar escaneo BLE complementario en paralelo
        const bleManager = this.getBleManager()
        if (bleManager) {
            try {
                bleManager.startDeviceScan(null, null, (error, bleDev) => {
                    if (!error && bleDev && bleDev.id) {
                        emitirOActualizar({
                            name: bleDev.name || bleDev.localName || "Dispositivo BLE",
                            address: bleDev.id,
                            type: "ble",
                        })
                    }
                })
            } catch (bleErr) {
                LogService.warn("[BLE] Error al iniciar escaneo BLE:", bleErr)
            }
        }

        // 4. Temporizador de descubrimiento activo: esperar a que termine la búsqueda o expire duracionMs
        await new Promise<void>((resolve) => {
            const timer = setTimeout(() => {
                resolve()
            }, duracionMs)

            classicPromise.finally(() => {
                clearTimeout(timer)
                resolve()
            })
        })

        // 5. Limpieza de listeners y detención del hardware de escaneo
        if (subscripcionClassic) {
            try {
                subscripcionClassic.remove()
            } catch {}
        }

        await this.cancelarDescubrimiento()

        return Array.from(mapaDispositivos.values())
    }

    /**
     * Abre directamente la pantalla nativa de Ajustes de Bluetooth del sistema operativo
     * para que el usuario pueda emparejar su Pocket Locker con PIN de emparejamiento nativo (2415).
     * En Android prioriza el intent nativo de ajustes Bluetooth para una experiencia ágil y sin fricciones.
     */
    async abrirAjustesBluetooth(): Promise<void> {
        if (Platform.OS === "android") {
            try {
                if (
                    NativeModules.RNBluetoothClassic &&
                    typeof NativeModules.RNBluetoothClassic.openBluetoothSettings === "function"
                ) {
                    NativeModules.RNBluetoothClassic.openBluetoothSettings()
                    return
                }
            } catch (e) {
                LogService.warn("[Bluetooth] Fallo al invocar openBluetoothSettings nativo:", e)
            }

            try {
                await Linking.sendIntent("android.settings.BLUETOOTH_SETTINGS")
                return
            } catch (intentErr) {
                LogService.warn("[Bluetooth] Fallo al enviar intent de ajustes bluetooth:", intentErr)
            }
        }

        try {
            await Linking.openSettings()
        } catch (linkErr) {
            LogService.warn("[Bluetooth] Fallo al abrir ajustes de sistema:", linkErr)
        }
    }

    /**
     * Establece conexión inalámbrica con el locker especificado con timeout controlado y reintentos.
     *
     * @param address Dirección MAC física o UUID del dispositivo
     * @param type Tipo de conexión ('classic' o 'ble')
     */
    async conectar(address: string, type: "classic" | "ble" = "classic"): Promise<void> {
        await this.cancelarDescubrimiento()

        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Tiempo de espera agotado: El Pocket Locker no responde")), 18000)
        )

        if (type === "classic") {
            if (!this.esClassicDisponible()) {
                throw new Error("El módulo nativo de Bluetooth Clásico no está disponible en este dispositivo")
            }

            try {
                if (this.dispositivoConectadoClassic && this.dispositivoConectadoClassic.address === address) {
                    const sigueConectado = await this.dispositivoConectadoClassic.isConnected()
                    if (sigueConectado) return
                }

                // Asegurar detención de cualquier escaneo y estabilizar el adaptador
                await this.cancelarDescubrimiento()
                await new Promise((r) => setTimeout(r, 250))

                // Verificar si ya está vinculado en el sistema operativo
                let yaEmparejado = false
                try {
                    const emparejados = await RNBluetoothClassic.getBondedDevices()
                    yaEmparejado =
                        Array.isArray(emparejados) &&
                        emparejados.some((d) => d && d.address && d.address.toLowerCase() === address.toLowerCase())
                } catch (pairCheckErr) {
                    LogService.warn("[Classic] Aviso al comprobar dispositivos emparejados:", pairCheckErr)
                }

                // Si nunca se ha vinculado previamente, solicitar vinculación nativa
                if (!yaEmparejado) {
                    LogService.info("[Classic] Dispositivo no vinculado previamente. Solicitando vinculación nativa para:", address)
                    try {
                        const pairPromise = RNBluetoothClassic.pairDevice(address)
                        const pairTimeout = new Promise((_, reject) =>
                            setTimeout(() => reject(new Error("Timeout esperando confirmación de vinculación")), 4000)
                        )
                        await Promise.race([pairPromise, pairTimeout])
                        LogService.info("[Classic] Vinculación nativa completada con éxito.")
                    } catch (pairErr) {
                        LogService.warn("[Classic] Aviso durante pairDevice (se continúa con intento de conexión directa):", pairErr)
                    }
                    // Margen de 400ms para permitir que la pila Bluetooth de Android asiente la clave de enlace
                    await new Promise((r) => setTimeout(r, 400))
                }

                // Conexión RFCOMM con reintentos y tolerancia a fallos transitorios de emparejamiento
                let device: BluetoothDevice | null = null
                let ultimoError: any = null
                const maxIntentos = 3

                for (let intento = 1; intento <= maxIntentos; intento++) {
                    try {
                        LogService.info(`[Classic] Abriendo canal RFCOMM con ${address} (intento ${intento}/${maxIntentos})...`)
                        const singleConnectPromise = RNBluetoothClassic.connectToDevice(address, {
                            delimiter: "\n",
                        })
                        const singleTimeout = new Promise<never>((_, reject) =>
                            setTimeout(() => reject(new Error("Tiempo de espera agotado al conectar")), 7000)
                        )
                        device = await Promise.race([singleConnectPromise, singleTimeout])
                        if (device) break
                    } catch (connErr) {
                        ultimoError = connErr
                        LogService.warn(`[Classic] Intento ${intento} fallido:`, connErr)
                        if (intento < maxIntentos) {
                            await new Promise((r) => setTimeout(r, intento * 700))
                        }
                    }
                }

                if (!device) {
                    throw ultimoError || new Error("No se pudo conectar al dispositivo")
                }

                this.dispositivoConectadoClassic = device

                // Registrar escucha activa de desconexión física y datos para Classic
                this.registrarMonitoreoDesconexionClassic(device, address)
            } catch (e: any) {
                this.dispositivoConectadoClassic = null
                throw new Error(`No se pudo conectar al dispositivo clásico: ${e?.message || "desconocido"}`)
            }
        } else {
            const manager = this.getBleManager()
            if (!manager) {
                throw new Error("Servicio BLE no disponible en este dispositivo")
            }

            try {
                if (this.dispositivoConectadoBle && this.dispositivoConectadoBle.id === address) {
                    const sigueConectado = await this.dispositivoConectadoBle.isConnected()
                    if (sigueConectado) return
                }

                const device = await Promise.race([manager.connectToDevice(address), timeoutPromise])
                await device.discoverAllServicesAndCharacteristics()
                this.dispositivoConectadoBle = device

                // Registrar escucha activa de desconexión física para BLE
                this.registrarMonitoreoDesconexion(device)
            } catch (e: any) {
                this.dispositivoConectadoBle = null
                throw new Error(`No se pudo conectar al dispositivo BLE: ${e?.message || "desconocido"}`)
            }
        }
    }

    /**
     * Envía un comando o trama de datos segura al microcontrolador conectado.
     *
     * @param comando Cadena de caracteres o trama formateada (ej. 'E', 'H' o 'PLK:2415:E\n')
     * @param type Tipo de conexión activa
     */
    async enviarComando(comando: string, type: "classic" | "ble" = "classic"): Promise<void> {
        // Asegurar que las tramas multicarácter finalicen con salto de línea si es protocolo seguro
        const payload = comando.endsWith("\n") ? comando : `${comando}\n`

        if (type === "classic") {
            if (!this.esClassicDisponible()) {
                throw new Error("El módulo nativo de Bluetooth Clásico no está disponible en este dispositivo")
            }
            if (!this.dispositivoConectadoClassic) {
                throw new Error("No hay dispositivo Clásico conectado")
            }
            try {
                await this.dispositivoConectadoClassic.write(payload)
            } catch (e: any) {
                throw new Error(`No se pudo enviar el comando clásico: ${e?.message || "desconocido"}`)
            }
        } else {
            if (!this.dispositivoConectadoBle) {
                throw new Error("No hay dispositivo BLE conectado")
            }
            try {
                const writeDetails = await this.encontrarCaracteristicaEscritura(this.dispositivoConectadoBle)
                if (!writeDetails) {
                    throw new Error("No se encontró ninguna característica de escritura en el dispositivo BLE")
                }

                const base64Comando = this.toBase64(payload)
                if (writeDetails.isWritableWithoutResponse) {
                    await this.dispositivoConectadoBle.writeCharacteristicWithoutResponseForService(
                        writeDetails.serviceUUID,
                        writeDetails.characteristicUUID,
                        base64Comando
                    )
                } else {
                    await this.dispositivoConectadoBle.writeCharacteristicWithResponseForService(
                        writeDetails.serviceUUID,
                        writeDetails.characteristicUUID,
                        base64Comando
                    )
                }
            } catch (e: any) {
                throw new Error(`No se pudo enviar el comando BLE: ${e?.message || "desconocido"}`)
            }
        }
    }

    /**
     * Envía un comando y espera de forma asíncrona la confirmación o código de error del ESP32.
     *
     * @param comando Comando o trama a transmitir
     * @param type Tipo de enlace Bluetooth ('classic' | 'ble')
     * @param timeoutMs Tiempo máximo de espera para la respuesta (por defecto 3000 ms)
     * @returns Respuesta estructurada recibida del microcontrolador
     */
    async enviarComandoConRespuesta(
        comando: string,
        type: "classic" | "ble" = "classic",
        timeoutMs: number = 3000
    ): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            let finalizado = false
            const callbackOriginal = this.onDatosRecibidosCallback

            const limpiar = () => {
                finalizado = true
                clearTimeout(timer)
                this.onDatosRecibidosCallback = callbackOriginal
            }

            const timer = setTimeout(() => {
                if (!finalizado) {
                    limpiar()
                    // Fallback tolerante: si se agota el tiempo pero el write fue OK, consideramos enviado
                    resolve("OK:TIMEOUT_FALLBACK")
                }
            }, timeoutMs)

            this.onDatosRecibidosCallback = (linea: string) => {
                if (callbackOriginal) callbackOriginal(linea)

                if (finalizado) return

                if (linea.startsWith("OK:") || linea.startsWith("INFO:")) {
                    limpiar()
                    resolve(linea)
                } else if (linea.startsWith("ERR:COOLDOWN:")) {
                    limpiar()
                    const partes = linea.split(":")
                    // El firmware envía "ERR:COOLDOWN:<PUERTA>:<SEGUNDOS>" (ej. ERR:COOLDOWN:PEATONAL:5)
                    // Soportamos tanto formato con nombre de puerta (partes[3]) como formato directo en ms/seg (partes[2])
                    let seg = 5
                    if (partes.length >= 4) {
                        const parsed = parseInt(partes[3], 10)
                        seg = isNaN(parsed) ? 5 : parsed
                    } else if (partes.length >= 3) {
                        const parsed = parseInt(partes[2], 10)
                        if (!isNaN(parsed)) {
                            seg = parsed > 100 ? Math.ceil(parsed / 1000) : parsed
                        }
                    }
                    reject(new Error(`Relé en enfriamiento. Espera ${seg}s para volver a pulsar.`))
                } else if (linea.startsWith("ERR:EN_EJECUCION")) {
                    limpiar()
                    reject(new Error("La apertura ya se encuentra en ejecución actualmente."))
                } else if (linea.startsWith("ERR:BLOQUEADO")) {
                    limpiar()
                    reject(new Error("Tu acceso está bloqueado o tus días de validez han expirado."))
                } else if (linea.startsWith("ERR:SIN_PERMISO_PEATONAL")) {
                    limpiar()
                    reject(new Error("No tienes permiso de acceso a la puerta peatonal."))
                } else if (linea.startsWith("ERR:SIN_PERMISO_GARAJE")) {
                    limpiar()
                    reject(new Error("No tienes permiso de acceso al portón de garaje."))
                } else if (linea.startsWith("ERR:SIN_PERMISO")) {
                    limpiar()
                    reject(new Error("No tienes permiso asignado para esta puerta."))
                } else if (linea.startsWith("ERR:AUTH_INVALIDA") || linea.startsWith("ERR:AUTH_FALLIDA")) {
                    limpiar()
                    reject(new Error("Clave o firma de seguridad incorrecta. Revisa el PIN en Ajustes."))
                } else if (linea.startsWith("ERR:")) {
                    limpiar()
                    reject(new Error(`Error del locker: ${linea}`))
                }
            }

            try {
                await this.enviarComando(comando, type)
            } catch (e) {
                limpiar()
                reject(e)
            }
        })
    }

    /**
     * Envía un comando y recopila líneas de telemetría continuas hasta una línea delimitadora
     * (por ejemplo 'END:USERS') o agotarse el tiempo de espera.
     */
    async enviarComandoEsperarLineas(
        comando: string,
        lineaFin: string = "END:USERS",
        type: "classic" | "ble" = "classic",
        timeoutMs: number = 4000
    ): Promise<string[]> {
        return new Promise<string[]>(async (resolve) => {
            const lineas: string[] = []
            let finalizado = false
            const callbackOriginal = this.onDatosRecibidosCallback

            const limpiar = () => {
                finalizado = true
                clearTimeout(timer)
                this.onDatosRecibidosCallback = callbackOriginal
            }

            const timer = setTimeout(() => {
                if (!finalizado) {
                    limpiar()
                    resolve(lineas)
                }
            }, timeoutMs)

            this.onDatosRecibidosCallback = (linea: string) => {
                if (callbackOriginal) callbackOriginal(linea)
                if (finalizado) return

                if (linea.startsWith(lineaFin)) {
                    limpiar()
                    resolve(lineas)
                } else {
                    lineas.push(linea)
                }
            }

            try {
                await this.enviarComando(comando, type)
            } catch {
                limpiar()
                resolve(lineas)
            }
        })
    }

    /**
     * Cierra de forma ordenada y limpia cualquier conexión activa existente.
     */
    async desconectar(): Promise<void> {
        if (this.disconnectSubscription) {
            try {
                this.disconnectSubscription.remove()
            } catch (e) {
                // Ignorar
            }
            this.disconnectSubscription = null
        }

        if (this.classicDisconnectSubscription) {
            try {
                this.classicDisconnectSubscription.remove()
            } catch (e) {
                // Ignorar
            }
            this.classicDisconnectSubscription = null
        }

        if (this.dataSubscription) {
            try {
                this.dataSubscription.remove()
            } catch (e) {
                // Ignorar
            }
            this.dataSubscription = null
        }

        if (this.esClassicDisponible() && this.dispositivoConectadoClassic) {
            try {
                await this.dispositivoConectadoClassic.disconnect()
            } catch (e) {
                LogService.warn("Error al desconectar clásico", e)
            } finally {
                this.dispositivoConectadoClassic = null
            }
        }

        if (this.dispositivoConectadoBle) {
            try {
                await this.dispositivoConectadoBle.cancelConnection()
            } catch (e) {
                LogService.warn("Error al desconectar BLE", e)
            } finally {
                this.dispositivoConectadoBle = null
            }
        }
    }

    /**
     * Verifica si actualmente existe un enlace de comunicación abierto con el hardware.
     */
    async estaConectado(type: "classic" | "ble" = "classic"): Promise<boolean> {
        if (type === "classic") {
            if (!this.esClassicDisponible() || !this.dispositivoConectadoClassic) return false
            try {
                return await this.dispositivoConectadoClassic.isConnected()
            } catch {
                return false
            }
        } else {
            if (!this.dispositivoConectadoBle) return false
            try {
                return await this.dispositivoConectadoBle.isConnected()
            } catch {
                return false
            }
        }
    }

    /**
     * Cancela cualquier proceso de búsqueda o escaneo activo en ambos subsistemas.
     */
    async cancelarDescubrimiento(): Promise<void> {
        if (this.bleScanTimeout) {
            clearTimeout(this.bleScanTimeout)
            this.bleScanTimeout = null
        }

        if (this.esClassicDisponible()) {
            try {
                await RNBluetoothClassic.cancelDiscovery()
            } catch (e) {
                LogService.warn("Error al cancelar discovery clásico", e)
            }
        }
        try {
            const manager = this.getBleManager()
            if (manager) {
                manager.stopDeviceScan()
            }
        } catch (e) {
            LogService.warn("Error al cancelar discovery BLE", e)
        }
    }

    /**
     * Inspecciona los servicios del dispositivo BLE para encontrar la primera característica escribible.
     */
    private async encontrarCaracteristicaEscritura(device: Device): Promise<{
        serviceUUID: string
        characteristicUUID: string
        isWritableWithoutResponse: boolean
    } | null> {
        try {
            const services = await device.services()
            for (const service of services) {
                const characteristics = await service.characteristics()
                for (const char of characteristics) {
                    if (char.isWritableWithResponse || char.isWritableWithoutResponse) {
                        return {
                            serviceUUID: service.uuid,
                            characteristicUUID: char.uuid,
                            isWritableWithoutResponse: char.isWritableWithoutResponse,
                        }
                    }
                }
            }
            return null
        } catch (e) {
            LogService.warn("Error buscando características de escritura BLE", e)
            return null
        }
    }

    /**
     * Convierte una cadena de texto a codificación Base64 en puro JavaScript sin dependencias nativas.
     */
    private toBase64(str: string): string {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
        let output = ""
        for (let i = 0; i < str.length; i += 3) {
            const c1 = str.charCodeAt(i)
            const c2 = i + 1 < str.length ? str.charCodeAt(i + 1) : NaN
            const c3 = i + 2 < str.length ? str.charCodeAt(i + 2) : NaN
            const byte1 = c1 >> 2
            const byte2 = ((c1 & 3) << 4) | (isNaN(c2) ? 0 : c2 >> 4)
            const byte3 = isNaN(c2) ? 64 : ((c2 & 15) << 2) | (isNaN(c3) ? 0 : c3 >> 6)
            const byte4 = isNaN(c3) ? 64 : c3 & 63
            output += chars.charAt(byte1) + chars.charAt(byte2) + chars.charAt(byte3) + chars.charAt(byte4)
        }
        return output
    }
}

const BluetoothService = new BluetoothServiceClass()
export default BluetoothService
