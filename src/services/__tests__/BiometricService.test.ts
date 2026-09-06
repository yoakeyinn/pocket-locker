import * as LocalAuthentication from 'expo-local-authentication';
import BiometricService from '../BiometricService';

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

describe('BiometricService (Autenticación Biométrica / Huella Dactilar)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debería retornar error si el hardware no soporta biometría', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(false);

    const res = await BiometricService.autenticarParaEditarPin();
    expect(res.exito).toBe(false);
    expect(res.mensajeError).toContain('sensor biométrico');
  });

  it('debería retornar error si el usuario no tiene huella registrada', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(false);

    const res = await BiometricService.autenticarParaEditarPin();
    expect(res.exito).toBe(false);
    expect(res.mensajeError).toContain('huella dactilar');
  });

  it('debería autenticar correctamente cuando la huella coincide', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });

    const res = await BiometricService.autenticarParaEditarPin();
    expect(res.exito).toBe(true);
  });

  it('debería indicar cancelación cuando el usuario pulsa cancelar', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({
      success: false,
      error: 'user_cancel',
    });

    const res = await BiometricService.autenticarParaEditarPin();
    expect(res.exito).toBe(false);
    expect(res.cancelado).toBe(true);
  });

  it('debería indicar fallo cuando la huella no coincide', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({
      success: false,
      error: 'authentication_failed',
      warning: 'Huella no reconocida',
    });

    const res = await BiometricService.autenticarParaEditarPin();
    expect(res.exito).toBe(false);
    expect(res.mensajeError).toBe('Huella no reconocida');
  });
});
