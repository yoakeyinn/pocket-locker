import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { activarFuentes, estiloConFuente, FAMILIA_TITULO } from '../../../src/styles/tipografia/fonts';
import { Text, TextInput } from '../../../src/styles/tipografia/Tipografia';
import tw from '../../../src/styles/styles';

const resolver = (style: unknown) => StyleSheet.flatten(estiloConFuente(style));

describe('tipografía de la app', () => {
  afterEach(() => activarFuentes(false));

  describe('Tailwind', () => {
    it('`font-display` genera la familia que reconoce fonts.ts para los títulos', () => {
      expect(tw`font-display`.fontFamily).toBe(FAMILIA_TITULO);
    });
  });

  describe('con las fuentes sin cargar', () => {
    it('no toca el estilo (se usa la fuente del sistema)', () => {
      const estilo = tw`text-sm font-bold`;
      expect(estiloConFuente(estilo)).toBe(estilo);
    });
  });

  describe('texto normal (Inter)', () => {
    beforeEach(() => activarFuentes(true));

    it('sin peso usa Inter Regular', () => {
      expect(resolver(tw`text-sm`)).toMatchObject({ fontFamily: 'Inter_400Regular', fontWeight: 'normal' });
    });

    it('traduce cada peso de Tailwind al archivo de Inter correspondiente', () => {
      expect(resolver(tw`font-medium`).fontFamily).toBe('Inter_500Medium');
      expect(resolver(tw`font-semibold`).fontFamily).toBe('Inter_600SemiBold');
      expect(resolver(tw`font-bold`).fontFamily).toBe('Inter_700Bold');
    });

    it('los pesos que no se cargan usan el más cercano', () => {
      expect(resolver(tw`font-extrabold`).fontFamily).toBe('Inter_700Bold');
      expect(resolver(tw`font-black`).fontFamily).toBe('Inter_700Bold');
      expect(resolver(tw`font-light`).fontFamily).toBe('Inter_300Light');
    });

    it('quita fontWeight para que Android no añada negrita sintética', () => {
      expect(resolver(tw`font-bold`).fontWeight).toBe('normal');
    });

    it('conserva el resto del estilo y respeta arrays, falsos y el último valor', () => {
      const r = resolver([tw`text-xs font-bold text-black`, false, null, [tw`font-medium`]]);
      expect(r.fontFamily).toBe('Inter_500Medium');
      expect(r.fontSize).toBe(tw`text-xs`.fontSize);
      expect(r.color).toBe(tw`text-black`.color);
    });
  });

  describe('títulos (Playfair Display)', () => {
    beforeEach(() => activarFuentes(true));

    it('usa Playfair fina y cursiva sea cual sea el peso pedido', () => {
      for (const peso of ['font-light', 'font-bold', 'font-extrabold', 'font-black']) {
        expect(resolver(tw`font-display ${peso}`).fontFamily).toBe('PlayfairDisplay_400Regular_Italic');
      }
      expect(resolver(tw`font-display`).fontFamily).toBe('PlayfairDisplay_400Regular_Italic');
    });
  });

  describe('fuentes explícitas', () => {
    beforeEach(() => activarFuentes(true));

    it('respeta font-mono (PIN, direcciones MAC) sin sustituirla', () => {
      const estilo = tw`font-mono text-xs`;
      expect(estiloConFuente(estilo)).toBe(estilo);
    });
  });

  describe('componentes Text y TextInput', () => {
    it('Text aplica la fuente a su estilo cuando está activa', async () => {
      activarFuentes(true);
      const { getByText } = await render(<Text style={tw`font-bold`}>Hola</Text>);
      expect(StyleSheet.flatten(getByText('Hola').props.style).fontFamily).toBe('Inter_700Bold');
    });

    it('TextInput aplica la fuente a su estilo cuando está activa', async () => {
      activarFuentes(true);
      const { getByPlaceholderText } = await render(<TextInput placeholder="PIN" style={tw`text-sm`} />);
      expect(StyleSheet.flatten(getByPlaceholderText('PIN').props.style).fontFamily).toBe('Inter_400Regular');
    });

    it('Text no cambia nada si las fuentes no están activas', async () => {
      const { getByText } = await render(<Text style={tw`font-bold`}>Hola</Text>);
      expect(StyleSheet.flatten(getByText('Hola').props.style).fontFamily).toBeUndefined();
    });
  });
});
