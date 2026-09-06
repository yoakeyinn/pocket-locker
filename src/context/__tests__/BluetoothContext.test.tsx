import React from "react"
import { renderHook, act, waitFor } from "@testing-library/react-native"
import { BluetoothProvider, useBluetooth } from "../BluetoothContext"
import BluetoothService from "../../services/BluetoothService"
import StorageService, { DEFAULT_SECURITY_PIN } from "../../services/StorageService"

// Mock de StorageService
jest.mock("../../services/StorageService", () => ({
    __esModule: true,
    DEFAULT_SECURITY_PIN: "2415",
    parsearYValidarPin: jest.fn().mockReturnValue({
        esValido: true,
        esAdmin: true,
        peatonal: true,
        garaje: true,
        dias: null,
    }),
    default: {
        getDeviceMac: jest.fn(),
        getDeviceName: jest.fn(),
        getDevicePin: jest.fn().mockResolvedValue("2415"),
        saveDevice: jest.fn().mockResolvedValue(undefined),
        saveDevicePin: jest.fn().mockResolvedValue(undefined),
        clearDevice: jest.fn().mockResolvedValue(undefined),
        obtenerDispositivo: jest.fn(),
        getUltimaPuerta: jest.fn().mockResolvedValue("peatonal"),
        saveUltimaPuerta: jest.fn().mockResolvedValue(undefined),
        updateUserStatus: jest.fn().mockResolvedValue(undefined),
        getUserName: jest.fn().mockResolvedValue(null),
        saveUserName: jest.fn().mockResolvedValue(undefined),
    },
}))

// Mock de react-native-bluetooth-classic
jest.mock("react-native-bluetooth-classic", () => ({
    __esModule: true,
    default: {
        onBluetoothEnabled: jest.fn().mockReturnValue({ remove: jest.fn() }),
        onBluetoothDisabled: jest.fn().mockReturnValue({ remove: jest.fn() }),
    },
}))

// Mock de BluetoothService
jest.mock("../../services/BluetoothService", () => ({
    __esModule: true,
    default: {
        esSoportado: jest.fn().mockResolvedValue(true),
        estaEncendido: jest.fn().mockResolvedValue(true),
        solicitarPermisos: jest.fn().mockResolvedValue(true),
        conectar: jest.fn().mockResolvedValue(undefined),
        desconectar: jest.fn().mockResolvedValue(undefined),
        enviarComando: jest.fn().mockResolvedValue(undefined),
        enviarComandoConRespuesta: jest.fn().mockResolvedValue("OK:PUERTA"),
        estaConectado: jest.fn().mockResolvedValue(false),
        registrarOnDesconexion: jest.fn(),
        registrarOnDatosRecibidos: jest.fn(),
    },
}))

// Mock de LogService para mantener la consola de los tests limpia
jest.mock("../../services/LogService", () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}))

describe("BluetoothContext", () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it("debería inicializar con estado unpaired si no hay MAC guardada", async () => {
        ;(StorageService.obtenerDispositivo as jest.Mock).mockResolvedValue({
            mac: null,
            name: null,
            type: "classic",
            pin: DEFAULT_SECURITY_PIN,
        })

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <BluetoothProvider>{children}</BluetoothProvider>
        )

        const { result } = await renderHook(() => useBluetooth(), { wrapper })

        await waitFor(() => {
            expect(result.current.status).toBe("unpaired")
        })

        expect(result.current.deviceMac).toBeNull()
        expect(result.current.deviceName).toBeNull()
    })

    it("debería inicializar y conectar si hay una MAC guardada", async () => {
        ;(StorageService.obtenerDispositivo as jest.Mock).mockResolvedValue({
            mac: "00:11:22:33:44:55",
            name: "PocketLocker BT",
            type: "classic",
            pin: "2415",
        })

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <BluetoothProvider>{children}</BluetoothProvider>
        )

        const { result } = await renderHook(() => useBluetooth(), { wrapper })

        await waitFor(() => {
            expect(result.current.status).toBe("connected")
        })

        expect(result.current.deviceMac).toBe("00:11:22:33:44:55")
        expect(result.current.deviceName).toBe("PocketLocker BT")
        expect(BluetoothService.conectar).toHaveBeenCalledWith("00:11:22:33:44:55", "classic")
    })

    it("debería actualizar el dispositivo vinculado y conectar", async () => {
        ;(StorageService.obtenerDispositivo as jest.Mock).mockResolvedValue({
            mac: null,
            name: null,
            type: "classic",
            pin: DEFAULT_SECURITY_PIN,
        })

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <BluetoothProvider>{children}</BluetoothProvider>
        )

        const { result } = await renderHook(() => useBluetooth(), { wrapper })

        await act(async () => {
            await result.current.actualizarDispositivoVinculado("AA:BB:CC:DD:EE:FF", "Nuevo Locker")
        })

        expect(StorageService.saveDevice).toHaveBeenCalledWith("AA:BB:CC:DD:EE:FF", "Nuevo Locker", "classic", "2415", "Usuario")
        expect(result.current.deviceMac).toBe("AA:BB:CC:DD:EE:FF")
        expect(result.current.deviceName).toBe("Nuevo Locker")
        expect(result.current.status).toBe("connected")
    })

    it("debería desvincular el dispositivo y limpiar AsyncStorage", async () => {
        ;(StorageService.obtenerDispositivo as jest.Mock).mockResolvedValue({
            mac: "00:11:22:33:44:55",
            name: "PocketLocker BT",
            type: "classic",
            pin: "2415",
        })

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <BluetoothProvider>{children}</BluetoothProvider>
        )

        const { result } = await renderHook(() => useBluetooth(), { wrapper })

        await waitFor(() => {
            expect(result.current.status).toBe("connected")
        })

        await act(async () => {
            await result.current.desvincularDispositivo()
        })

        expect(StorageService.clearDevice).toHaveBeenCalled()
        expect(result.current.deviceMac).toBeNull()
        expect(result.current.deviceName).toBeNull()
        expect(result.current.status).toBe("unpaired")
        expect(BluetoothService.desconectar).toHaveBeenCalled()
    })

    it("debería renombrar el dispositivo y actualizar el almacenamiento", async () => {
        ;(StorageService.obtenerDispositivo as jest.Mock).mockResolvedValue({
            mac: "00:11:22:33:44:55",
            name: "PocketLocker BT",
            type: "classic",
            pin: "2415",
        })

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <BluetoothProvider>{children}</BluetoothProvider>
        )

        const { result } = await renderHook(() => useBluetooth(), { wrapper })

        await waitFor(() => {
            expect(result.current.status).toBe("connected")
        })

        await act(async () => {
            await result.current.renombrarDispositivo("Nuevo Nombre")
        })

        expect(StorageService.saveDevice).toHaveBeenCalledWith("00:11:22:33:44:55", "Nuevo Nombre", "classic", "2415", "Usuario")
        expect(result.current.deviceName).toBe("Nuevo Nombre")
    })

    it("debería actualizar el PIN de seguridad del dispositivo", async () => {
        ;(StorageService.obtenerDispositivo as jest.Mock).mockResolvedValue({
            mac: "00:11:22:33:44:55",
            name: "PocketLocker BT",
            type: "classic",
            pin: "2415",
        })

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <BluetoothProvider>{children}</BluetoothProvider>
        )

        const { result } = await renderHook(() => useBluetooth(), { wrapper })

        await waitFor(() => {
            expect(result.current.status).toBe("connected")
        })

        await act(async () => {
            await result.current.actualizarPinDispositivo("9999")
        })

        expect(StorageService.saveDevicePin).toHaveBeenCalledWith("9999")
        expect(result.current.devicePin).toBe("9999")
    })

    it("debería enviar la trama segura PLK:<PIN>:<CMD> al invocar enviarComando", async () => {
        ;(StorageService.obtenerDispositivo as jest.Mock).mockResolvedValue({
            mac: "00:11:22:33:44:55",
            name: "PocketLocker BT",
            type: "classic",
            pin: "2415",
        })

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <BluetoothProvider>{children}</BluetoothProvider>
        )

        const { result } = await renderHook(() => useBluetooth(), { wrapper })

        await waitFor(() => {
            expect(result.current.status).toBe("connected")
        })

        await act(async () => {
            await result.current.enviarComando("P")
        })

        expect(BluetoothService.enviarComandoConRespuesta).toHaveBeenCalledWith("PLK:2415:E", "classic")

        await act(async () => {
            await result.current.enviarComando("G")
        })

        expect(BluetoothService.enviarComandoConRespuesta).toHaveBeenCalledWith("PLK:2415:H", "classic")
    })

    it("debería iniciar el margen de tiempo de bloqueo correctamente", async () => {
        ;(StorageService.obtenerDispositivo as jest.Mock).mockResolvedValue({
            mac: null,
            name: null,
            type: "classic",
            pin: DEFAULT_SECURITY_PIN,
        })

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <BluetoothProvider>{children}</BluetoothProvider>
        )

        const { result, unmount } = await renderHook(() => useBluetooth(), { wrapper })

        await waitFor(() => {
            expect(result.current.status).toBe("unpaired")
        })

        expect(result.current.tiempoRestanteBloqueo).toBe(0)

        await act(async () => {
            result.current.iniciarBloqueoMargen(5)
        })

        expect(result.current.tiempoRestanteBloqueo).toBe(5)
        unmount()
    })

    it("debería inicializar con la última puerta guardada en StorageService", async () => {
        ;(StorageService.obtenerDispositivo as jest.Mock).mockResolvedValue({
            mac: null,
            name: null,
            type: "classic",
            pin: DEFAULT_SECURITY_PIN,
        })
        ;(StorageService.getUltimaPuerta as jest.Mock).mockResolvedValue("garaje")

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <BluetoothProvider>{children}</BluetoothProvider>
        )

        const { result } = await renderHook(() => useBluetooth(), { wrapper })

        await waitFor(() => {
            expect(result.current.ultimaPuerta).toBe("garaje")
        })
    })

    it("debería guardar la última puerta al llamar a guardarUltimaPuerta", async () => {
        ;(StorageService.obtenerDispositivo as jest.Mock).mockResolvedValue({
            mac: null,
            name: null,
            type: "classic",
            pin: DEFAULT_SECURITY_PIN,
        })

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <BluetoothProvider>{children}</BluetoothProvider>
        )

        const { result } = await renderHook(() => useBluetooth(), { wrapper })

        await act(async () => {
            await result.current.guardarUltimaPuerta("garaje")
        })

        expect(result.current.ultimaPuerta).toBe("garaje")
        expect(StorageService.saveUltimaPuerta).toHaveBeenCalledWith("garaje")
    })

    it("debería activar y desactivar el modo DEMO correctamente", async () => {
        ;(StorageService.obtenerDispositivo as jest.Mock).mockResolvedValue({
            mac: null,
            name: null,
            type: "classic",
            pin: DEFAULT_SECURITY_PIN,
        })

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <BluetoothProvider>{children}</BluetoothProvider>
        )

        const { result } = await renderHook(() => useBluetooth(), { wrapper })

        await waitFor(() => {
            expect(result.current.status).toBe("unpaired")
        })

        await act(async () => {
            await result.current.activarModoDemo()
        })

        expect(result.current.isDemoMode).toBe(true)
        expect(result.current.status).toBe("connected")
        expect(result.current.deviceName).toBe("Pocket Locker (DEMO)")
        expect(result.current.userRole).toBe("admin")

        await act(async () => {
            await result.current.desactivarModoDemo()
        })

        expect(result.current.isDemoMode).toBe(false)
        expect(result.current.status).toBe("unpaired")
    })

    it("debería guardar el nombre de usuario de forma persistente", async () => {
        ;(StorageService.obtenerDispositivo as jest.Mock).mockResolvedValue({
            mac: null,
            name: null,
            type: "classic",
            pin: DEFAULT_SECURITY_PIN,
        })

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <BluetoothProvider>{children}</BluetoothProvider>
        )

        const { result } = await renderHook(() => useBluetooth(), { wrapper })

        await act(async () => {
            await result.current.guardarNombreUsuario("Alba")
        })

        expect(result.current.userName).toBe("Alba")
        expect(StorageService.saveUserName).toHaveBeenCalledWith("Alba")
    })
})

