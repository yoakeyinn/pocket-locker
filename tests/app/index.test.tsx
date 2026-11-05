import React from 'react';
import { StyleSheet } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import SplashScreen from '../../src/app/index';
import tw from '../../src/styles/styles';
import { mostrarModal } from '../../src/components/Modal';
import BluetoothService from '../../src/services/BluetoothService';
import { useArranque } from '../../src/services/arranque';
import { usePreferencias } from '../../src/services/preferencias';
import { Biometria } from '../../src/services/Biometria';

const mockBt = BluetoothService as unknown as Record<string, jest.Mock>;

const mockEstado = { cargando: true, deviceMac: null as string | null, userName: 'Ana' as string | null };
jest.mock('../../src/services/BluetoothService', () => ({
  __esModule: true,
  default: {
    esSoportado: jest.fn(),
    estaEncendido: jest.fn(),
    tienePermisos: jest.fn(),
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
  beforeEach(() => usePreferencias.setState({ cargadas: true, biometria: false, desbloqueada: false }));

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

    it('dura 1 s en total: pasa a /buscar si no hay dispositivo vinculado', async () => {
      Object.assign(mockEstado, { cargando: false, deviceMac: null, userName: 'Ana' });
      await render(<SplashScreen />);
      await avanzar(900);
      expect(router.replace).not.toHaveBeenCalled();
      await avanzar(200);
      expect(router.replace).toHaveBeenCalledWith('/buscar');
    });

    it('pasa a /puertas si hay dispositivo vinculado', async () => {
      Object.assign(mockEstado, { cargando: false, deviceMac: 'AA:BB', userName: 'Ana' });
      await render(<SplashScreen />);
      await avanzar(750);
      await avanzar(250);
      expect(router.replace).toHaveBeenCalledWith('/puertas');
    });

    it('la primera vez (sin nombre de usuario) el splash dura 3 s y va a /login', async () => {
      Object.assign(mockEstado, { cargando: false, deviceMac: null, userName: null });
      await render(<SplashScreen />);
      await avanzar(2900);
      expect(router.replace).not.toHaveBeenCalled();
      await avanzar(200);
      expect(router.replace).toHaveBeenCalledWith('/login');
    });

    it('con nombre guardado el splash dura 1 s', async () => {
      Object.assign(mockEstado, { cargando: false, deviceMac: 'AA:BB', userName: 'Ana' });
      await render(<SplashScreen />);
      await avanzar(900);
      expect(router.replace).not.toHaveBeenCalled();
      await avanzar(200);
      expect(router.replace).toHaveBeenCalledWith('/puertas');
    });

    it('marca el arranque en curso mientras se ve y lo libera justo antes de navegar', async () => {
      Object.assign(mockEstado, { cargando: false, deviceMac: null, userName: 'Ana' });
      await render(<SplashScreen />);
      expect(useArranque.getState().enCurso).toBe(true);

      await avanzar(750);
      await avanzar(250);
      expect(router.replace).toHaveBeenCalled();
      expect(useArranque.getState().enCurso).toBe(false);
    });

    it('libera el arranque si se desmonta antes de terminar', async () => {
      const { unmount } = await render(<SplashScreen />);
      expect(useArranque.getState().enCurso).toBe(true);
      await unmount();
      expect(useArranque.getState().enCurso).toBe(false);
    });

    it('con el bloqueo activado no sale del splash hasta verificar la identidad; al verificar, va a su destino', async () => {
      Object.assign(mockEstado, { cargando: false, deviceMac: 'AA:BB', userName: 'Ana' });
      usePreferencias.setState({ biometria: true, desbloqueada: false });
      let resolver!: (ok: boolean) => void;
      const autenticar = jest.spyOn(Biometria, 'autenticar').mockImplementation(() => new Promise((r) => (resolver = r)));
      await render(<SplashScreen />);
      await avanzar(750);
      await avanzar(500);
      expect(autenticar).toHaveBeenCalledTimes(1);
      expect(router.replace).not.toHaveBeenCalled();

      await act(async () => resolver(true));
      await avanzar(300);
      expect(usePreferencias.getState().desbloqueada).toBe(true);
      expect(router.replace).toHaveBeenCalledWith('/puertas');
      autenticar.mockRestore();
    });

    it('si se cancela la verificación se vuelve a pedir y no se entra', async () => {
      Object.assign(mockEstado, { cargando: false, deviceMac: 'AA:BB', userName: 'Ana' });
      usePreferencias.setState({ biometria: true, desbloqueada: false });
      const autenticar = jest.spyOn(Biometria, 'autenticar').mockResolvedValue(false);
      await render(<SplashScreen />);
      await avanzar(750);
      await avanzar(100);
      expect(autenticar).toHaveBeenCalledTimes(1);
      await avanzar(1100);
      expect(autenticar.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(router.replace).not.toHaveBeenCalled();
      autenticar.mockRestore();
    });

    it('con la huella activada pero ya desbloqueada en esta sesión va directo a su destino', async () => {
      Object.assign(mockEstado, { cargando: false, deviceMac: 'AA:BB', userName: 'Ana' });
      usePreferencias.setState({ biometria: true, desbloqueada: true });
      await render(<SplashScreen />);
      await avanzar(750);
      await avanzar(250);
      expect(router.replace).toHaveBeenCalledWith('/puertas');
    });

    it('espera a que se hayan leído las preferencias (tema y huella) antes de salir', async () => {
      Object.assign(mockEstado, { cargando: false, deviceMac: null, userName: 'Ana' });
      usePreferencias.setState({ cargadas: false });
      await render(<SplashScreen />);
      await avanzar(10000);
      expect(router.replace).not.toHaveBeenCalled();

      await act(async () => usePreferencias.setState({ cargadas: true }));
      await avanzar(1000);
      expect(router.replace).toHaveBeenCalledWith('/buscar');
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
      mockBt.tienePermisos.mockResolvedValue(true);
      mockBt.solicitarPermisos.mockResolvedValue(true);
      mockBt.pedirActivar.mockResolvedValue(true);
      mockBt.abrirAjustesBluetooth.mockResolvedValue(undefined);
    });
    afterEach(() => jest.useRealTimers());

    const botones = () => (mostrarModal as jest.Mock).mock.calls[0][2] as { text: string; onPress: () => void }[];
    const botonesDelUltimo = () => (mostrarModal as jest.Mock).mock.lastCall![2] as { text: string; onPress: () => void }[];

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

    it('con el bloqueo activado el aviso del Bluetooth sale después de verificar, ya en la pantalla siguiente', async () => {
      usePreferencias.setState({ biometria: true, desbloqueada: false });
      const autenticar = jest.spyOn(Biometria, 'autenticar').mockResolvedValue(true);
      await render(<SplashScreen />);
      await avanzar(5000);
      expect(autenticar).toHaveBeenCalled();
      expect(router.replace).toHaveBeenCalled();
      expect(mostrarModal).toHaveBeenCalledTimes(1);
      autenticar.mockRestore();
    });

    it('"Encender" con los permisos ya concedidos pide directamente la activación', async () => {
      await render(<SplashScreen />);
      await avanzar(5000);

      await act(async () => botones()[1].onPress());
      expect(mockBt.solicitarPermisos).not.toHaveBeenCalled();
      expect(mockBt.pedirActivar).toHaveBeenCalled();
    });

    describe('sin permisos de Bluetooth', () => {
      beforeEach(() => mockBt.tienePermisos.mockResolvedValue(false));

      it('"Encender" explica los permisos en un modal y, al aceptar, los pide y luego pide la activación', async () => {
        await render(<SplashScreen />);
        await avanzar(5000);

        await act(async () => {
          botones()[1].onPress();
        });
        expect((mostrarModal as jest.Mock).mock.calls[1][0]).toBe('Permisos requeridos');
        expect(mockBt.solicitarPermisos).not.toHaveBeenCalled();

        await act(async () => botonesDelUltimo().find((b) => b.text === 'Conceder permisos')!.onPress());
        expect(mockBt.solicitarPermisos).toHaveBeenCalled();
        expect(mockBt.pedirActivar).toHaveBeenCalled();
      });

      it('si se cancela el modal de permisos no se pide nada al sistema', async () => {
        await render(<SplashScreen />);
        await avanzar(5000);

        await act(async () => {
          botones()[1].onPress();
        });
        await act(async () => (mostrarModal as jest.Mock).mock.calls[1][2][0].onPress());
        expect(mockBt.solicitarPermisos).not.toHaveBeenCalled();
        expect(mockBt.pedirActivar).not.toHaveBeenCalled();
      });

      it('si se rechazan los permisos del sistema no se pide la activación', async () => {
        mockBt.solicitarPermisos.mockResolvedValue(false);
        await render(<SplashScreen />);
        await avanzar(5000);

        await act(async () => {
          botones()[1].onPress();
        });
        await act(async () => botonesDelUltimo().find((b) => b.text === 'Conceder permisos')!.onPress());
        expect(mockBt.pedirActivar).not.toHaveBeenCalled();
      });
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
