jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native-bluetooth-classic', () => ({ __esModule: true, default: {} }));
jest.mock('react-native-ble-plx', () => ({ BleManager: jest.fn() }));
jest.mock('../../src/components/Modal', () => ({ mostrarModal: jest.fn() }));

import { mostrarModal } from '../../src/components/Modal';
import BluetoothService from '../../src/services/BluetoothService';
import { pedirPermisosBluetooth } from '../../src/services/Permisos';

const botones = () => (mostrarModal as jest.Mock).mock.calls[0][2] as { text: string; onPress: () => void }[];

describe('pedirPermisosBluetooth (modal de la app antes del diálogo del sistema)', () => {
  let solicitar: jest.SpyInstance;
  let tiene: jest.SpyInstance;

  beforeEach(() => {
    (mostrarModal as jest.Mock).mockClear();
    solicitar = jest.spyOn(BluetoothService, 'solicitarPermisos').mockResolvedValue(true);
    tiene = jest.spyOn(BluetoothService, 'tienePermisos').mockResolvedValue(false);
  });
  afterEach(() => jest.restoreAllMocks());

  it('con los permisos ya concedidos no muestra nada ni pregunta al sistema', async () => {
    tiene.mockResolvedValue(true);
    await expect(pedirPermisosBluetooth()).resolves.toBe(true);
    expect(mostrarModal).not.toHaveBeenCalled();
    expect(solicitar).not.toHaveBeenCalled();
  });

  it('sin permisos explica el motivo en un modal y no toca el sistema hasta que se acepta', async () => {
    const resultado = pedirPermisosBluetooth();
    await Promise.resolve();
    await Promise.resolve();

    const [titulo, mensaje] = (mostrarModal as jest.Mock).mock.calls[0];
    expect(titulo).toBe('Permisos requeridos');
    expect(mensaje).toContain('Pocket Locker');
    expect(botones().map((b) => b.text)).toEqual(['Cancelar', 'Conceder permisos']);
    expect(solicitar).not.toHaveBeenCalled();

    botones()[1].onPress();
    await expect(resultado).resolves.toBe(true);
    expect(solicitar).toHaveBeenCalledTimes(1);
  });

  it('si se cancela devuelve false sin pedir nada al sistema', async () => {
    const resultado = pedirPermisosBluetooth();
    await Promise.resolve();
    await Promise.resolve();
    botones()[0].onPress();
    await expect(resultado).resolves.toBe(false);
    expect(solicitar).not.toHaveBeenCalled();
  });

  it('si el usuario deniega el diálogo del sistema devuelve false', async () => {
    solicitar.mockResolvedValue(false);
    const resultado = pedirPermisosBluetooth();
    await Promise.resolve();
    await Promise.resolve();
    botones()[1].onPress();
    await expect(resultado).resolves.toBe(false);
  });
});
