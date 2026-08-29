# Pocket Locker

Sistema de control de accesos inalámbrico para puertas y portones mediante Bluetooth y ESP32.

---

## Novedades de la versión 1.1.1

- Autenticación criptográfica HMAC-SHA256 con protocolo Challenge-Response (anti-replay mediante nonces de un solo uso).
- Eliminación de comandos directos sin autenticación en el microcontrolador.
- Almacenamiento seguro del PIN en hardware keystore (expo-secure-store).
- Telemetría bidireccional y confirmaciones transaccionales en tiempo real (ACK/NACK y control de cooldown).
- Persistencia de claves en memoria flash no volátil (NVS) del ESP32.
- Detección reactiva de desconexión física y timeout de conexión controlado (4.5s).

---

## Inicio Rápido

### 1. Clonar repositorio
```bash
git clone <URL_DEL_REPOSITORIO>
cd pocket-locker
```

### 2. Firmware ESP32 (PlatformIO)
El código del microcontrolador se encuentra en `esp32/`.

1. Abrir la carpeta `esp32/` en VS Code con la extensión PlatformIO IDE.
2. Compilar:
   ```bash
   pio run -d esp32
   ```
3. Subir al dispositivo:
   ```bash
   pio run -d esp32 -t upload
   ```
4. Monitor serie a 115200 baudios.

### 3. Aplicación Móvil (React Native / Expo)
El código de la aplicación se encuentra en `src/`.

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Ejecutar:
   - Modo Simulación: `npx expo start`
   - Build de desarrollo con Bluetooth nativo:
     ```bash
     npx expo prebuild
     npx expo run:android   # Android
     npx expo run:ios       # iOS
     ```
