import React from 'react';
import { LogService, StorageService } from '../services/StorageService';
import { t } from '../styles/i18n';
import { setTema, Tema, useTema } from '../styles/styles';
import { Selector } from './Selector';

export const SelectorTema: React.FC = () => {
  const actual = useTema();

  const elegir = (tema: Tema) => {
    setTema(tema);
    StorageService.saveTema(tema).catch((e) => LogService.warn('[Tema] No se pudo guardar el tema', e));
  };

  return (
    <Selector
      id="tema"
      valor={actual}
      onChange={elegir}
      opciones={[
        { valor: 'claro', etiqueta: t('pl_tema_claro') },
        { valor: 'oscuro', etiqueta: t('pl_tema_oscuro') },
      ]}
    />
  );
};
