export type TipoDispositivo = 'classic' | 'ble';
export type Puerta = 'peatonal' | 'garaje';

export const DEFAULT_SECURITY_PIN = '2415';
export const USUARIO_POR_DEFECTO = 'Usuario';

// Modo de revisión (`npm run simular`): lista separada por comas de opciones, o vacío si no se simula nada.
export const modoSimulacion = (): string => process.env.EXPO_PUBLIC_SIMULAR_BT ?? '';

// El Pocket Locker se reconoce por el nombre con el que anuncia su Bluetooth (ESP32 con nombre PLBT).
export const esLocker = (dispositivo: { name?: string | null }): boolean => {
  const nombre = (dispositivo.name ?? '').toUpperCase();
  return nombre.includes('PLBT') || nombre.includes('POCKET LOCKER') || nombre.includes('ESP32');
};
