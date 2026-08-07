# Pocket Locker

Aplicación móvil para el control de accesos de puertas y portones mediante conexión Bluetooth.

## Inicio Rápido

Para instalar las dependencias e iniciar el servidor de desarrollo:

```bash
npm install
npx expo start
```

## Desarrollo y Compilación

Dado que la aplicación incluye dependencias nativas para la comunicación Bluetooth, se requiere utilizar una build de desarrollo en lugar de Expo Go:

```bash
npx expo prebuild
npx expo run:android
# o
npx expo run:ios
```

## Recursos Visuales

Antes de compilar la aplicación para distribución, asegúrate de colocar los recursos correspondientes en la ruta `assets/images/`:
- `icon.png` (Icono de la aplicación)
