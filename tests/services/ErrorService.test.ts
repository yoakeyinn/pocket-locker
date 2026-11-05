jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../../src/components/Modal', () => ({ mostrarModalError: jest.fn() }));
jest.mock('../../src/services/BluetoothService', () => ({
  usePocketStore: {
    getState: () => ({
      status: 'connected',
      deviceName: 'Locker de prueba',
      deviceMac: 'AA:BB:CC:DD:EE:FF',
      deviceType: 'classic',
      cargando: false,
    }),
  },
}));

import { LogBox } from 'react-native';
import { mostrarModalError } from '../../src/components/Modal';
import { construirInforme, instalarCapturaDeErrores, reportarErrorFatal } from '../../src/services/ErrorService';
import { LogService } from '../../src/services/StorageService';

describe('ErrorService', () => {
  beforeAll(() => {
    jest.spyOn(LogBox, 'ignoreAllLogs').mockImplementation(() => {});
  });

  beforeEach(() => (mostrarModalError as jest.Mock).mockClear());

  it('el informe lleva versión, plataforma, estado, error con su pila y el registro reciente', () => {
    LogService.info('[Prueba] paso previo al fallo');
    const informe = construirInforme(new Error('canal RFCOMM caído'), 'Contexto de prueba');

    expect(informe).toMatch(/v\d+\.\d+\.\d+ - informe de error/);
    expect(informe).toMatch(/Plataforma: /);
    expect(informe).toContain('bluetooth=connected');
    expect(informe).toContain('Locker de prueba (AA:BB:CC:DD:EE:FF)');
    expect(informe).toContain('Contexto: Contexto de prueba');
    expect(informe).toContain('Error: canal RFCOMM caído');
    expect(informe).toContain('Pila:');
    expect(informe).toContain('[INFO] [Prueba] paso previo al fallo');
  });

  it('acepta errores que no son instancias de Error', () => {
    expect(construirInforme('texto suelto', 'x')).toContain('texto suelto');
    expect(construirInforme({ codigo: 133 }, 'x')).toContain('"codigo": 133');
  });

  it('reportarErrorFatal deja el error en el registro y abre el modal con el informe', () => {
    reportarErrorFatal(new Error('fallo grave'), 'Prueba fatal');

    expect(LogService.getLogs()[0].message).toBe('[FATAL] Prueba fatal');
    expect(LogService.getLogs()[0].extra).toContain('fallo grave');
    expect(mostrarModalError).toHaveBeenCalledTimes(1);
    const [titulo, mensaje, informe] = (mostrarModalError as jest.Mock).mock.calls[0];
    expect(titulo).toBe('Algo ha salido mal');
    expect(mensaje).toMatch(/^Lo sentimos\./);
    expect(mensaje).toContain('no puede continuar');
    expect(informe).toContain('[FATAL] Prueba fatal');
    expect(informe).toContain('fallo grave');
  });

  describe('informe breve', () => {
    it('no mete URLs de Metro ni cientos de frames de React: el informe es corto', () => {
      const error = new Error('fallo grave');
      error.stack = [
        'Error: fallo grave',
        'at miFuncion (http://192.168.1.129:8081/index.bundle//&platform=android&dev=true:100:5)',
        ...Array.from({ length: 300 }, (_, i) => `at recursivelyTraversePassiveMountEffects (http://192.168.1.129:8081/index.bundle//&x=1:${i}:3)`),
      ].join('\n');
      const informe = construirInforme(error, 'Prueba');

      expect(informe).toContain('at miFuncion (100:5)');
      expect(informe).not.toContain('http://');
      expect(informe).not.toContain('recursivelyTraverse');
      expect(informe.length).toBeLessThan(4000);
    });

    it('los avisos repetidos seguidos se juntan con (×n) y la pila de cada aviso se resume', () => {
      for (let i = 0; i < 3; i++) {
        LogService.warn('[BLE] BleManager no disponible', Object.assign(new Error('null'), { stack: 'Error: null\nat a (http://h:1/x:1:2)\nat b (http://h:1/x:3:4)' }));
      }
      const informe = construirInforme(new Error('x'), 'Prueba');
      expect(informe).toContain('[BLE] BleManager no disponible (×3)');
      expect(informe).toContain('at a (1:2)');
      expect(informe).not.toContain('http://h:1');
    });

    it('incluye como mucho las últimas 40 entradas del registro', () => {
      for (let i = 0; i < 120; i++) LogService.info(`[Prueba] entrada única número ${i}`);
      const informe = construirInforme(new Error('x'), 'Prueba');
      expect((informe.match(/\[Prueba\] entrada única/g) ?? []).length).toBe(40);
      expect(informe).toContain('entrada única número 119');
      expect(informe).not.toContain('entrada única número 70');
    });
  });

  describe('captura global de excepciones', () => {
    it('solo muestra el modal de error: una excepción fatal lo abre y una no fatal solo se registra', () => {
      const setGlobalHandler = jest.fn();
      const previo = jest.fn();
      const seguimiento = jest.fn();
      (globalThis as any).ErrorUtils = { setGlobalHandler, getGlobalHandler: () => previo };
      (globalThis as any).HermesInternal = { enablePromiseRejectionTracker: seguimiento };

      instalarCapturaDeErrores();
      instalarCapturaDeErrores();
      expect(setGlobalHandler).toHaveBeenCalledTimes(1);
      const manejador = setGlobalHandler.mock.calls[0][0];

      manejador(new Error('no fatal'), false);
      expect(mostrarModalError).not.toHaveBeenCalled();
      expect(previo).not.toHaveBeenCalled();
      expect(LogService.getLogs()[0].message).toBe('Excepcion de JavaScript no fatal');

      manejador(new Error('fatal'), true);
      expect(mostrarModalError).toHaveBeenCalledTimes(1);
      expect(previo).not.toHaveBeenCalled();
    });

    it('silencia los avisos y errores superpuestos de React Native (LogBox) para que solo salga el modal', () => {
      expect(LogBox.ignoreAllLogs).toHaveBeenCalledWith(true);
    });

    it('registra las promesas rechazadas sin capturar, sin abrir el modal', () => {
      const { onUnhandled } = (globalThis as any).HermesInternal.enablePromiseRejectionTracker.mock.calls[0][0];
      onUnhandled(1, new Error('promesa suelta'));

      expect(LogService.getLogs()[0].message).toBe('Promesa rechazada sin capturar');
      expect(LogService.getLogs()[0].extra).toContain('promesa suelta');
      expect(mostrarModalError).not.toHaveBeenCalled();
    });
  });

  it('LogService.error no usa console.error: React Native lo reenviaría como excepción y entraría en bucle', () => {
    const consola = jest.spyOn(console, 'error').mockImplementation(() => {});
    LogService.error('algo falló', new Error('detalle'));
    expect(consola).not.toHaveBeenCalled();
    consola.mockRestore();
  });
});
