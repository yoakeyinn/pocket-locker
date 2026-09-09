import { create } from 'twrnc';

/**
 * Paleta de colores oficial de la aplicación Pocket Locker.
 */
export const Colors = {
  beigeBg: '#FAF8F2',
  beigeCard: '#FFFFFF',
  azulPrimario: '#2C5F8A',
  azulOscuro: '#1A3A5C',
  azulClaro: '#E8F0F8',
  errorRojo: '#E85D5D',
  exitoVerde: '#49A241',
  textoSecundario: '#6B6B6B',
};

/**
 * Versión oficial de la aplicación Pocket Locker.
 */
export const APP_VERSION = '1.5.0';

/**
 * Instancia centralizada de Tailwind CSS para React Native (twrnc).
 */
export const tw = create(require('../tailwind.config.js'));
export default tw;
