# <img src="./assets/icon.png" width="40" height="40" style="border-radius: 50%; vertical-align: middle;" alt="Pocket Locker Logo" /> Pocket Locker

App móvil (Expo / React Native) para abrir una puerta peatonal y un portón de garaje desde el teléfono, por Bluetooth, con un ESP32 que activa dos relés.

## Qué necesitas

- **Hardware:** una placa ESP32, un módulo de 2 relés, cables y un cable USB. Teléfono con Android 8+ o iOS 13+.
- **Software:** Git, Node.js 18+, VS Code con la extensión **PlatformIO IDE**.

## Conexiones

| ESP32        | Módulo de relés | Función                    |
| :----------- | :-------------- | :------------------------- |
| **GPIO 26**  | IN1             | Portón de garaje           |
| **GPIO 27**  | IN2             | Puerta peatonal            |
| **VIN / 5V** | VCC             | Alimentación del módulo    |
| **GND**      | GND             | Masa común                 |

Los relés se activan en nivel bajo. Para probar con LEDs (GPIO → resistencia → LED → GND, activos en alto) usa el entorno `esp32dev_leds` de PlatformIO.

## Puesta en marcha

1. **Clonar e instalar**
   ```bash
   git clone https://github.com/yoakeyinn/pocket-locker.git
   cd pocket-locker
   npm install
   ```
2. **Programar el ESP32:** abre la carpeta `esp32/` en VS Code, conecta la placa y sube el firmware con el botón *Upload* de PlatformIO o con `pio run -t upload`. Al terminar, el ESP32 emite Bluetooth con el nombre **PLBT** y el PIN por defecto **2415**.
3. **Instalar la app en el teléfono.** Expo Go no incluye Bluetooth, así que hace falta una build nativa (con el teléfono conectado por USB y la depuración USB activada en Android):
   ```bash
   npx expo prebuild
   npx expo run:android   # o: npx expo run:ios (requiere Mac con Xcode)
   ```
4. **Vincular:** con el Bluetooth encendido, abre la app. Detecta el PLBT por sí sola y te pide confirmar; si no, pulsa *Ver dispositivos manualmente*, elige **PLBT** e introduce el PIN. Después usa *Puerta* o *Garaje* en la pantalla principal.

## Probar la app sin ESP32

```bash
npm run simular                       # con un locker ya vinculado
npm run simular -- --sin-vincular     # empieza en la búsqueda
npm run simular -- --bluetooth-apagado
```

Simula un adaptador Bluetooth y siete dispositivos cercanos (el PLBT entre ellos) para revisar todas las pantallas. Funciona también en Expo Go. Añade `--dev-client --tunnel` si lo necesitas.

## Desarrollo

```bash
npm test             # tests (Jest)
npx tsc --noEmit     # comprobación de tipos
```

Builds con EAS: perfiles `development`, `preview` (APK) y `production` en `eas.json`. La versión se cambia solo en `package.json`. Las decisiones de diseño y las reglas del código están en [CLAUDE.md](./CLAUDE.md).

## Seguridad

- Cada pulsación activa el relé **5 s**, con un enfriamiento de **5 s** antes de aceptar otra.
- Un PIN erróneo añade una espera creciente a los siguientes intentos, pero no bloquea el acceso.
- El firmware admite autenticación por desafío (HMAC-SHA256 con nonce de 15 s), pero **la app envía hoy el PIN directamente**. No lo uses como única barrera de seguridad.
- El PIN de la app se guarda en el almacén seguro del teléfono. El PIN por defecto (2415) está en el código del firmware y de la app (`DEFAULT_SECURITY_PIN` en `src/services/comun.ts`); cámbialo en ambos antes de un uso real. La app no tiene todavía una pantalla para cambiarlo.
