import React from 'react';
import { LogService, StorageService } from '../services/StorageService';
import { Idioma, setIdioma, t, useIdioma } from '../styles/i18n';
import { Selector } from './Selector';

export const SelectorIdioma: React.FC = () => {
  const actual = useIdioma();

  const elegir = (idioma: Idioma) => {
    setIdioma(idioma);
    StorageService.saveIdioma(idioma).catch((e) => LogService.warn('[Idioma] No se pudo guardar el idioma', e));
  };

  return (
    <Selector
      id="idioma"
      valor={actual}
      onChange={elegir}
      opciones={[
        { valor: 'es', etiqueta: t('pl_idioma_es') },
        { valor: 'en', etiqueta: t('pl_idioma_en') },
      ]}
    />
  );
};
