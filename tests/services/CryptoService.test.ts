jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import { CryptoService } from "../../src/services/StorageService";

describe("CryptoService HMAC-SHA256", () => {
    it("debería calcular el hash HMAC-SHA256 correctamente", () => {
        const key = "2415";
        const message = "a1b2c3d4e5f6:E";
        const hmac = CryptoService.hmacSha256(key, message);

        expect(typeof hmac).toBe("string");
        expect(hmac.length).toBe(64);
        expect(hmac).toMatch(/^[0-9a-f]{64}$/);
    });

    it("debería satisfacer el vector de prueba RFC 4231 Test Case 1", () => {
        const key = String.fromCharCode(...new Array(20).fill(0x0b));
        const data = "Hi There";
        const expected = "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7";

        const result = CryptoService.hmacSha256(key, data);
        expect(result).toBe(expected);
    });

    it("debería satisfacer el vector de prueba RFC 4231 Test Case 2", () => {
        const key = "Jefe";
        const data = "what do ya want for nothing?";
        const expected = "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843";

        const result = CryptoService.hmacSha256(key, data);
        expect(result).toBe(expected);
    });
});
