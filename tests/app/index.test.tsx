import React from 'react';
import { StyleSheet } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import SplashScreen from '../../src/app/index';
import tw from '../../src/styles/styles';
import { mostrarModal } from '../../src/components/Modal';
import BluetoothService from '../../src/services/BluetoothService';

const mockBt = BluetoothService as unknown as Record<string, jest.Mock>;

const mockEstado = { cargando: true, deviceMac: null as string | null, userName: 'Ana' as string | null };
jest.mock('../../src/services/BluetoothService', () => ({
  __esModule: true,
  default: {
    esSoportado: jest.fn(),
    estaEncendido: jest.fn(),
    solicitarPermisos: jest.fn(),
    pedirActivar: jest.fn(),
    abrirAjustesBluetooth: jest.fn(),
  },
  useBluetooth: () => mockEstado,
}));

jest.mock('../../src/services/StorageService', () => ({
  LogService: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../src/components/Modal', () => ({ mostrarModal: jest.fn() }));

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
}));

const estilo = (el: any) => StyleSheet.flatten(el.props.style) as Record<string, any>;

describe('SplashScreen', () => {
  it('muestra la imagen del icono de la app', async () => {
    const { getByLabelText } = await render(<SplashScreen />);
    expect(getByLabelText('Pocket Locker')).toBeTruthy();
  });

  it('pinta los textos en blanco y negro (escala de grises, sin azul)', async () => {
    const { getByText } = await render(<SplashScreen />);
    expect(estilo(getByText('Pocket Locker')).color).toBe(estilo({ props: { style: tw`text-black` } }).color);
    expect(estilo(getByText('Control de acceso seguro')).color).toBe(
      estilo({ props: { style: tw`text-gray` } }).color
    );
  });

  it('muestra una barra de 6 estrellas', async () => {
    const { getAllByTestId } = await render(<SplashScreen />);
    expect(getAllByTestId('splash-estrella')).toHaveLength(6);
  });

  describe('navegación al terminar', () => {
    const avanzar = (ms: number) => act(async () => { jest.advanceTimersByTime(ms); });

    beforeEach(() => {
      jest.useFakeTimers();
      (router.replace as jest.Mock).mockClear();
      (mostrarModal as jest.Mock).mockClear();
      mockBt.esSoportado.mockResolvedValue(true);
      mockBt.estaEncendido.mockResolvedValue(true);
      mockBt.pedirActivar.mockResolvedValue(true);
      mockBt.abrirAjustesBluetooth.mockResolvedValue(undefined);
    });
    afterEach(() => jest.useRealTimers());

    it('pasa a /buscar tras 3 s si no hay dispositivo vinculado', async () => {
      Object.assign(mockEstado, { cargando: false, deviceMac: null, userName: 'Ana' });
      await render(<SplashScreen />);
      await avanzar(2000);
      expect(router.replace).not.toHaveBeenCalled();
      await avanzar(2000);
      expect(router.replace).toHaveBeenCalledWith('/buscar');
    });

    it('pasa a /puertas si hay dispositivo vinculado', async () => {
      Object.assign(mockEstado, { cargando: false, deviceMac: 'AA:BB', userName: 'Ana' });
      await render(<SplashScreen />);
      await avanzar(3000);
      await avanzar(1000);
      expect(router.replace).toHaveBeenCalledWith('/puertas');
    });

    it('pasa a /nombre si todavía no hay nombre de usuario, aunque haya dispositivo', async () => {
      Object.assign(mockEstado, { cargando: false, deviceMac: 'AA:BB', userName: null });
      await render(<SplashScreen />);
      await avanzar(3000);
      await avanzar(1000);
      expect(router.replace).toHaveBeenCalledWith('/nombre');
    });

    it('espera mientras los datos siguen cargando', async () => {
      Object.assign(mockEstado, { cargando: true, deviceMac: null });
      await render(<SplashScreen />);
      await avanzar(10000);
      expect(router.replace).not.toHaveBeenCalled();
    });
  });

  describe('comprobación del Bluetooth al arrancar', () => {
    const avanzar = async (ms: number) => {
      await act(async () => { jest.advanceTimersByTime(ms); });
      await act(async () => { jest.advanceTimersByTime(500); });
    };

    beforeEach(() => {
      jest.useFakeTimers();
      (router.replace as jest.Mock).mockClear();
      (mostrarModal as jest.Mock).mockClear();
      Object.assign(mockEstado, { cargando: false, deviceMac: null, userName: 'Ana' });
      Object.values(mockBt).forEach((f) => f.mockReset());
      mockBt.esSoportado.mockResolvedValue(true);
      mockBt.estaEncendido.mockResolvedValue(false);
      mockBt.solicitarPermisos.mockResolvedValue(true);
      mockBt.pedirActivar.mockResolvedValue(true);
      mockBt.abrirAjustesBluetooth.mockResolvedValue(undefined);
    });
    afterEach(() => jest.useRealTimers());

    const botones = () => (mostrarModal as jest.Mock).mock.calls[0][2] as { text: string; onPress: () => void }[];

    it('con el Bluetooth apagado no avisa en el splash: navega y avisa ya en la pantalla siguiente', async () => {
      const orden: string[] = [];
      (router.replace as jest.Mock).mockImplementationOnce(() => orden.push('navegar'));
      (mostrarModal as jest.Mock).mockImplementationOnce(() => orden.push('modal'));

      await render(<SplashScreen />);
      await avanzar(5000);
      expect(orden).toEqual(['navegar', 'modal']);
      expect((mostrarModal as jest.Mock).mock.calls[0][0]).toBe('Bluetooth apagado');
      expect(botones().map((b) => b.text)).toEqual(['Ir a Ajustes', 'Encender']);
    });

    it('"Encender" pide primero los permisos (sin ellos Android no deja encenderlo) y luego la activación', async () => {
      await render(<SplashScreen />);
      await avanzar(5000);

      await act(async () => botones()[1].onPress());
      expect(mockBt.solicitarPermisos).toHaveBeenCalled();
      expect(mockBt.pedirActivar).toHaveBeenCalled();
    });

    it('"Encender" no pide la activación si se rechazan los permisos', async () => {
      mockBt.solicitarPermisos.mockResolvedValue(false);
      await render(<SplashScreen />);
      await avanzar(5000);

      await act(async () => botones()[1].onPress());
      expect(mockBt.pedirActivar).not.toHaveBeenCalled();
    });

    it('"Ir a Ajustes" abre los ajustes de Bluetooth', async () => {
      await render(<SplashScreen />);
      await avanzar(5000);

      await act(async () => botones()[0].onPress());
      expect(mockBt.abrirAjustesBluetooth).toHaveBeenCalled();
    });

    it('con el Bluetooth encendido no muestra ningún modal', async () => {
      mockBt.estaEncendido.mockResolvedValue(true);
      await render(<SplashScreen />);
      await avanzar(5000);

      expect(mostrarModal).not.toHaveBeenCalled();
      expect(router.replace).toHaveBeenCalledWith('/buscar');
    });

    it('sin Bluetooth en el dispositivo (p. ej. Expo Go) no avisa: lo gestiona la pantalla de búsqueda', async () => {
      mockBt.esSoportado.mockResolvedValue(false);
      await render(<SplashScreen />);
      await avanzar(5000);

      expect(mostrarModal).not.toHaveBeenCalled();
      expect(router.replace).toHaveBeenCalledWith('/buscar');
    });
  });
});
