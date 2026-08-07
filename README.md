# Pocket Locker

App de control de puerta peatonal y portón de garaje vía Bluetooth Clásico.

## Arrancar el proyecto

```bash
npm install
npx expo install --check
npx expo start --clear
```

Como el proyecto usa una librería con código nativo (`react-native-bluetooth-classic`) **NO funciona con Expo Go**. Necesitas una *development build*:

```bash
npx expo prebuild
npx expo run:android
```

## Iconos

La carpeta `assets/images/` está vacía a propósito. Coloca ahí tu propio
`icon.png` (1024×1024) antes de generar la build.

## Comandos enviados

- Pestaña **Peatonal** → envía la letra `E`
- Pestaña **Garaje**   → envía la letra `H`

La dirección MAC del dispositivo emparejado se guarda en `AsyncStorage`
bajo la clave `deviceMac`. Para forzar un re-emparejamiento, basta con
borrar esa clave (o desinstalar la app).

## Estructura

```
app/
  _layout.tsx        Layout raíz (Stack)
  index.tsx          Redirección a /splash
  splash.tsx         Splash 2s + decisión de ruta
  dispositivo.tsx    Vinculación BT (solo primera vez)
  (tabs)/
    _layout.tsx      Tab bar (Peatonal / Garaje)
    peatonal.tsx     Botón → comando "E"
    garaje.tsx       Botón → comando "H"
  resultado.tsx      Éxito/error + Volver/Salir
  +not-found.tsx     404
services/
  BluetoothService.ts  Wrapper de react-native-bluetooth-classic
constants/
  Colors.ts          Paleta beige + azul
```
