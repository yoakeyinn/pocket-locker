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
4. **Vincular:** la primera vez la app te pide tu nombre. Con el Bluetooth encendido, detecta el PLBT por sí sola y te pide confirmar; si no, pulsa *Ver dispositivos manualmente*, elige **PLBT** e introduce el código de acceso. Después usa *Puerta* o *Garaje* en la pantalla principal.

### Códigos de acceso

- **`2415`**: administrador, abre las dos puertas.
- **`2S0BP<p>G<g>[dd]`**: usuario. `p` y `g` valen 1 o 0 y autorizan la puerta peatonal y el garaje (no pueden ser 0 los dos); `dd` (1-99) son los días de acceso, opcionales. Ejemplos: `2S0BP1G1` (ambas), `2S0BP1G0` (solo peatonal), `2S0BP0G103` (solo garaje, 3 días).

La app solo enseña las puertas que autoriza el código; las restricciones reales las aplica el ESP32.

## Probar la app sin ESP32 (modo demo)

```bash
npm start     # muestra el QR; escanéalo con Expo Go o con tu build de desarrollo
```

En la pantalla de bienvenida escribe **`demo`** como nombre. A partir de ahí la app simula el Bluetooth (diez dispositivos cercanos, el segundo es el PLBT), la vinculación y las aperturas, para recorrer todas las pantallas sin ESP32. Con cualquier otro nombre no se simula nada. Para salir del modo demo, cambia el nombre en *Ajustes*.

## Desarrollo

```bash
npm test             # tests (Jest)
npx tsc --noEmit     # comprobación de tipos
```

Builds con EAS: perfiles `development`, `preview` (APK) y `production` en `eas.json`. La versión se cambia solo en `package.json`. Los comandos y la estructura del código están en [CLAUDE.md](./CLAUDE.md).

## Seguridad

- Cada pulsación activa el relé **5 s**, con un enfriamiento de **5 s** antes de aceptar otra.
- Un PIN erróneo añade una espera creciente a los siguientes intentos, pero no bloquea el acceso.
- El firmware admite autenticación por desafío (HMAC-SHA256 con nonce de 15 s), pero **la app envía hoy el PIN directamente**. No lo uses como única barrera de seguridad.
- El PIN de la app se guarda en el almacén seguro del teléfono. El PIN por defecto (2415) está en el código del firmware y de la app (`DEFAULT_SECURITY_PIN` en `src/services/comun.ts`); cámbialo en ambos antes de un uso real. La app no tiene todavía una pantalla para cambiarlo.

## Pendiente

Estado a 2026-11-05, rama `dev`, último commit `b9f86e6`. No se ha hecho `push` de nada.

### Funcionalidad por hacer

1. **Caducidad real de los códigos de días (`2S0BP…dd`).** Hoy el teléfono solo muestra "Acceso temporal: n día(s)" y no cuenta el tiempo. El ESP32 solo aplica la caducidad a usuarios registrados en su tabla por MAC (`PLK:REG:<nombre>:<código>`), y la app envía únicamente `PLK:<PIN>:<CMD>` y `PLK:LOG:…`, así que con la forma directa **el código nunca caduca**. Hay que:
   - Enviar `PLK:REG:<nombre>:<código>` tras vincular (respuestas `OK:REGISTRADO:USER:<p>:<g>:<días>`, `ERR:PIN_INVALIDO`, `ERR:DB_LLENA`).
   - Enviar `PLK:SYNC:<epoch>` al conectar para sincronizar el reloj del ESP32 y leer `INFO:<ACTIVO|BLOQUEADO>:<días restantes>:<p>:<g>`.
   - Mostrar los días restantes reales y tratar `ERR:BLOQUEADO` como "acceso caducado".
2. **Preferencia "Accesibilidad".** Existe el interruptor en las preferencias (login y ajustes) y se guarda (`accesibilidad`, `usePreferencias.accesibilidad`), pero **no hace nada**. Falta que Alba defina qué debe cambiar.
3. **Administrador.** El firmware admite `PLK:ADMIN:LIST` y bloquear, desbloquear y actualizar usuarios, y la app no los usa. No hay pantalla de gestión de usuarios ni de cambio del PIN de administrador.
4. **Textos en español fijo en el código** (sin pasar por `es.json`/`en.json`): casi todo `puertas`, `ajustes` y algunos errores de `BluetoothService`.
5. **Re-bloqueo al volver a la app.** El bloqueo con huella/PIN solo se pide en cada arranque en frío; no se vuelve a pedir al volver desde segundo plano.
6. **"Desvincular dispositivo"** (`clearDevice`) también borra el nombre de usuario guardado. Se propuso separarlos y no se ha decidido.

### Decisiones abiertas

- **PIN directo con huella registrada.** El diálogo de verificación es del sistema Android: su texto de ayuda ("Escanea tu huella digital") y su botón "Usar PIN" no se pueden cambiar ni saltar con `expo-local-authentication`. Saltar directamente al PIN exigiría parchear el código Android de la librería con `patch-package` (añadiría una dependencia de desarrollo y un `postinstall`). No está aprobado.
- **Momento de detección del PLBT en el radar (demo).** Ahora aparece a los 5 s (segundo de los diez dispositivos simulados); antes era a los 10 s. Confirmar cuál se prefiere.
- **Comentarios de `esp32/main.cpp`.** Los comentarios se borraron de la app, no del firmware.

### Por probar en un móvil real (nada de esto se ha visto en un dispositivo; solo hay tests)

- Tema oscuro por defecto con el splash en claro: posible parpadeo al pasar del splash a la siguiente pantalla.
- Bloqueo desde el splash: diálogo del sistema, reintento al cancelar, háptico al acertar, y que "Usar PIN" funcione.
- Vigilancia del Bluetooth en dispositivos cercanos (cada 1,5 s): apagarlo y encenderlo con la búsqueda en marcha, y los botones "Activar Bluetooth" y "Abrir ajustes del teléfono".
- Animaciones lentas del login, el radar y la cabecera de la lista; entrada rápida de las filas.
- Sombras y el aspecto de los botones de icono en Android real.
- Cierre completo de la app (`react-native-exit-app`): exige un build propio (`npx expo prebuild` y `npx expo run:android`) y no se ha comprobado su compatibilidad con la versión actual de Gradle. En iOS no se puede cerrar una app por código.
- `expo-local-authentication` y `expo-haptics` también necesitan ese build propio; en Expo Go solo funciona parte.

### Para retomar en una conversación nueva

- Las **reglas de trabajo** están en `.claude/rules/reglas.md` y la **teoría de la app** (estilo visual, flujos, protocolo, códigos de acceso, textos, modo demo, errores) en la skill `.claude/skills/documentacion/SKILL.md`. La carpeta `.claude/` está excluida de git en local (`.git/info/exclude`), no existe en GitHub y hay que copiarla si se clona en otro equipo.
- `.gitignore` no se toca ni se sube nunca.
- Git no tiene nombre ni correo configurados en este equipo; los commits usan `-c user.name` y `-c user.email` puntuales con la identidad de los commits anteriores.
- Para ver la primera ejecución (splash de 3 s, bienvenida, preferencias): *Ajustes → Borrar datos de la aplicación*. Para recorrer la app sin ESP32, el nombre `demo`.
- Antes de dar algo por hecho: `npm test` (246 tests) y `npx tsc --noEmit --noUnusedLocals`.
