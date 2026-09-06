import { create } from 'twrnc';

/**
 * Instancia centralizada y tipada de Tailwind CSS para React Native (twrnc).
 * Incorpora la paleta de colores y tokens de diseño oficiales de Pocket Locker.
 */
const tw = create(require('../../tailwind.config.js'));

export default tw;
