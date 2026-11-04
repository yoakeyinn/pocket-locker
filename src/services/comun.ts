export type TipoDispositivo = 'classic' | 'ble';
export type Puerta = 'peatonal' | 'garaje';

export const DEFAULT_SECURITY_PIN = '2415';
export const USUARIO_POR_DEFECTO = 'Usuario';

// Código de acceso: el PIN de administrador (2415) abre ambas puertas; un código de usuario
// «2S0BP<p>G<g>[dd]» autoriza la puerta peatonal (p) y/o el garaje (g) con 1/0 y, opcionalmente,
// caduca a los dd días (1-99). Se interpreta en el teléfono solo para mostrar lo que el código permite.
export interface AccesoPin {
  esValido: boolean;
  peatonal: boolean;
  garaje: boolean;
  dias: number | null;
}

const SIN_ACCESO: AccesoPin = { esValido: false, peatonal: false, garaje: false, dias: null };

export const parsearPin = (pin?: string | null): AccesoPin => {
  const codigo = typeof pin === 'string' ? pin.trim().toUpperCase() : '';
  if (codigo === DEFAULT_SECURITY_PIN) return { esValido: true, peatonal: true, garaje: true, dias: null };

  const partes = codigo.match(/^2S0BP([01])G([01])(\d{1,2})?$/);
  if (!partes) return SIN_ACCESO;
  const peatonal = partes[1] === '1';
  const garaje = partes[2] === '1';
  if (!peatonal && !garaje) return SIN_ACCESO;
  return { esValido: true, peatonal, garaje, dias: partes[3] ? parseInt(partes[3], 10) : null };
};

export const esPinValido = (pin?: string | null): boolean => parsearPin(pin).esValido;

// Modo de revisión (`npm run simular`): lista separada por comas de opciones, o vacío si no se simula nada.
export const modoSimulacion = (): string => process.env.EXPO_PUBLIC_SIMULAR_BT ?? '';

// El Pocket Locker se reconoce por el nombre con el que anuncia su Bluetooth (ESP32 con nombre PLBT).
export const esLocker = (dispositivo: { name?: string | null }): boolean => {
  const nombre = (dispositivo.name ?? '').toUpperCase();
  return nombre.includes('PLBT') || nombre.includes('POCKET LOCKER') || nombre.includes('ESP32');
};
