import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SelectorIdioma } from '../../src/components/SelectorIdioma';
import { StorageService } from '../../src/services/StorageService';
import { setIdioma, t } from '../../src/styles/i18n';

jest.mock('../../src/services/StorageService', () => ({
  LogService: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  StorageService: { saveIdioma: jest.fn().mockResolvedValue(undefined) },
}));

describe('SelectorIdioma', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setIdioma('es');
  });

  it('tiene la píldora deslizante y las dos opciones, con la actual marcada', async () => {
    const { getByTestId } = await render(<SelectorIdioma />);
    expect(getByTestId('idioma-indicador')).toBeTruthy();
    expect(getByTestId('idioma-es').props.accessibilityState).toEqual({ selected: true });
    expect(getByTestId('idioma-en').props.accessibilityState).toEqual({ selected: false });
  });

  it('al elegir otro idioma lo aplica, lo guarda y mueve la selección', async () => {
    const { getByTestId } = await render(<SelectorIdioma />);
    await act(async () => {
      fireEvent.press(getByTestId('idioma-en'));
    });
    expect(t('pl_idioma')).toBe('Language');
    expect(StorageService.saveIdioma).toHaveBeenCalledWith('en');
    expect(getByTestId('idioma-en').props.accessibilityState).toEqual({ selected: true });
  });

  it('pulsar el idioma ya activo no hace nada', async () => {
    const { getByTestId } = await render(<SelectorIdioma />);
    await act(async () => {
      fireEvent.press(getByTestId('idioma-es'));
    });
    expect(StorageService.saveIdioma).not.toHaveBeenCalled();
  });
});
