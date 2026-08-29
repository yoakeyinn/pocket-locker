# Pocket Locker

**Pocket Locker** es una solución móvil de control de accesos inalámbricos diseñada para gestionar de forma segura y eficiente la apertura y cierre de puertas peatonales y portones automáticos (garajes) utilizando conectividad Bluetooth.

La aplicación móvil se comunica con un módulo microcontrolador **ESP32** receptor que activa físicamente los relés del portón y la puerta peatonal mediante comandos específicos enviados de forma inalámbrica.

---

## 🚀 Guía de Inicio Rápido (Clonar y Configurar)

Sigue estos pasos para clonar el repositorio en tu máquina local y comenzar a trabajar:

### 1. Clonar el repositorio
Abre una terminal en la carpeta donde deseas guardar tus proyectos y clona el repositorio:

```bash
git clone <URL_DEL_REPOSITORIO>
cd pocket-locker
```

---

## 🛠️ Desarrollo del Firmware (ESP32) con PlatformIO

El código fuente del hardware está ubicado en el directorio [`esp32/`](file:///c:/Users/albat/Documents/proyectos/apps/pocket-locker/esp32).

### Requisitos previos en VS Code
1. Abre **Visual Studio Code**.
2. Ve a la pestaña de extensiones (o presiona `Ctrl+Shift+X`).
3. Busca e instala la extensión **PlatformIO IDE**.

### Cargar y Compilar el proyecto
1. En VS Code, ve a **Archivo > Abrir carpeta...** y selecciona únicamente la carpeta [`esp32/`](file:///c:/Users/albat/Documents/proyectos/apps/pocket-locker/esp32) de este repositorio.
2. PlatformIO reconocerá automáticamente el archivo [`platformio.ini`](file:///c:/Users/albat/Documents/proyectos/apps/pocket-locker/esp32/platformio.ini), configurando el entorno para placas ESP32 genéricas (`esp32dev`).
3. Para compilar el código: Haz clic en el icono del check (✓) en la barra de estado de PlatformIO (esquina inferior izquierda) o abre la paleta de comandos (`Ctrl+Shift+P`) y ejecuta `PlatformIO: Build`.
4. Para flashear/subir al ESP32: Conecta tu ESP32 mediante USB y haz clic en el icono de la flecha hacia la derecha (→) en la barra inferior, o ejecuta `PlatformIO: Upload`.
5. Abre el monitor serie (icono del enchufe en la barra inferior) para ver el log de conexiones con la velocidad configurada a `115200` baudios.

---

## 📱 Desarrollo de la Aplicación Móvil con Expo

La aplicación móvil está construida con **React Native (Expo)** y se ubica bajo el directorio raíz y la carpeta [`src/`](file:///c:/Users/albat/Documents/proyectos/apps/pocket-locker/src).

### Instalar dependencias
Desde la raíz del proyecto (`pocket-locker/`), instala las dependencias de Node.js:
```bash
npm install
```

### Opciones de prueba en el móvil

Dado que la aplicación incluye librerías nativas para Bluetooth Clásico y BLE (`react-native-bluetooth-classic` y `react-native-ble-plx`), el cliente estándar **Expo Go** no tiene acceso a estos componentes nativos en dispositivos reales. Tienes dos maneras de probar la aplicación:

#### Opción A: Probar sin hacer una build (Modo Simulación / Demo)
Si solo quieres probar la interfaz de usuario, flujos de navegación, lógica interna o estilos en un simulador o en tu dispositivo físico mediante la app **Expo Go** sin configurar compiladores nativos:
1. Asegúrate de tener la app **Expo Go** instalada en tu móvil.
2. Inicia el servidor de desarrollo:
   ```bash
   npx expo start
   ```
3. Escanea el código QR desde tu móvil con la cámara (iOS) o la app de Expo Go (Android).
4. Dentro de la aplicación, ve al **Panel de Control** y activa el **Modo Demo (Simulación)** presionando el icono de depuración (icono de bug 🐛 o de herramienta de desarrollo en la cabecera).
5. Podrás simular el comportamiento de apertura y respuesta de ambas puertas sin necesidad de conectarse físicamente a la placa ESP32.

#### Opción B: Probar con una Build de Desarrollo (Para probar el Bluetooth real)
Para probar la comunicación Bluetooth real y la integración directa con el ESP32:
1. Genera los archivos de proyecto nativo (prebuild):
   ```bash
   npx expo prebuild
   ```
2. Compila y ejecuta la build de desarrollo en tu dispositivo físico conectado mediante USB (o un emulador con soporte Bluetooth):
   * **Para Android:**
     ```bash
     npx expo run:android
     ```
   * **Para iOS:**
     ```bash
     npx expo run:ios
     ```
3. Esto generará e instalará una versión personalizada de la aplicación en tu móvil que incluye los módulos nativos de Bluetooth requeridos para enlazarse con el ESP32 (`sblas20`).
