# CLAUDE.md

**Pocket Locker**: Expo / React Native app that opens a pedestrian door and a garage gate over Bluetooth (ESP32 driving two relays). Identifiers, UI texts and docs are Spanish; this file is English. Stack: Expo SDK 58, RN 0.88 (new arch, Hermes), expo-router, twrnc, zustand, Jest 30 (`jest-expo`) + `@testing-library/react-native`.

Rules that always apply: @.claude/rules/reglas.md. App theory (visual style, screens and flows, protocol, access codes, i18n, demo mode, errors): skill `documentacion` (`.claude/skills/documentacion`); read it before touching UI, texts or flows.

## Commands
- `npm start` Expo dev server (no web target). `npm run android|ios` native build. Real Bluetooth needs a dev build (`npx expo prebuild` + `npx expo run:android`); Expo Go has no BLE/Classic modules. EAS profiles in `eas.json`.
- `npm test`; one file `npx jest <path>`; one test `-t "<name>"`. Type-check `npx tsc --noEmit --noUnusedLocals` (ignore errors under `tests/` about jest globals).
- Demo (no ESP32, works in Expo Go): type `demo` as the name in `login`.
- ESP32 firmware: `esp32/main.cpp` (PlatformIO, `pio run -t upload`).
- Version only in `package.json`. Write multi-line edit scripts with the Write tool (bash heredocs with mixed quotes fail).

## Code map
- `src/app` (each file is a route; no tests/helpers): `_layout`, `index` (splash), `login`, `buscar`, `puertas` (root), `ajustes`.
- `src/components`: shared ones at top level (`Boton`, `BotonIcono`, `Campo`, `Selector`/`SelectorIdioma`/`SelectorTema`, `Interruptor`, `Preferencias`, `Aparece`, `Cargando`, `Estrella`, `Modal`/`ModalHost`/`mostrarModal`, `LimiteDeErrores`, `SinDispositivoCard`). A component used by one screen goes in a folder named after it, one per file (`buscar/`, `puertas/`, `ajustes/`); move it up when a second screen uses it.
- `src/services`: `BluetoothService.tsx` (transports + zustand `usePocketStore` + provider), `StorageService.ts` (`LogService`, `CryptoService`, `StorageService`), `ErrorService.ts`, `arranque.ts`, `Permisos.ts`, `preferencias.ts`, `Simulacion.ts`, `Biometria.ts`, `AvisoBluetooth.ts`, `Reinicio.ts`, `Salir.ts`, `pila.ts`, `comun.ts`.
- `src/styles`: `styles.ts` (`tw`, `Colors`, `tipografia`, splash styles), `tipografia/`, `i18n/`, `margenes.ts`. `tests/` mirrors `src/`; `tailwind.config.js` holds the palettes; `app.config.js` is the dynamic Expo config (plugin patches Android Bluetooth permissions and `buildFeatures.buildConfig = true` for `react-native-bluetooth-classic` with AGP 8+).

## Native pitfalls
- Crashes that JS cannot catch: guard `requestBluetoothEnabled`, `getBondedDevices`, `vincularDispositivo`, `cancelarDescubrimiento` with `isBluetoothAvailable()`/`tienePermisos()`; automatic calls use `pedirActivar(false)`. `expo-intent-launcher` loads lazily with fallback to `Linking.openSettings()`.
- Never `require` an optional native module without checking it exists (Metro reports the failed load as a fatal error even inside try/catch); `Salir.ts` checks `NativeModules.RNExitApp ?? TurboModuleRegistry.get('RNExitApp')` first, and `Modal.tsx` requires `Salir` lazily on press so importing the modal does not drag native modules.

## Tests
- `__mocks__/` mocks `expo-local-authentication` and `react-native-exit-app`. `Platform.OS` is `ios` and the default theme is light in Jest. `useMargenesSeguros()` returns zeros without a `SafeAreaProvider`. Use `await render(...)` and `await act(async () => ...)` around state-changing `fireEvent`.
- Tests that `jest.mock('react-native')` without `Animated` must also mock `Aparece`, `Cargando`, `Preferencias`; ones mocking it for `puertas` need `useWindowDimensions` and `Easing.bezier`. Tests importing `BluetoothService` need `async-storage`, `react-native-bluetooth-classic` and `react-native-ble-plx` mocked.
- Guard tests: `tema`, `paleta`, `modales`, `Cargando`, `Modal`, `i18n`.
