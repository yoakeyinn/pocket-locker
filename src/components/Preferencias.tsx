import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Interruptor } from './Interruptor';
import { SelectorIdioma } from './SelectorIdioma';
import { SelectorTema } from './SelectorTema';
import { Biometria, MetodoBloqueo } from '../services/Biometria';
import { LogService, StorageService } from '../services/StorageService';
import { ERROR_BLOQUEO_PENDIENTE, marcarDesbloqueada, setAccesibilidad, setBiometria, usePreferencias } from '../services/preferencias';
import { ClaveLiteral, t, useIdioma } from '../styles/i18n';
import { Text } from '../styles/tipografia/Tipografia';
import tw, { Colors, tipografia, useTema } from '../styles/styles';

const ALTO_FILA = 60;

const Fila: React.FC<{
  icono: React.ComponentProps<typeof Feather>['name'];
  etiqueta: string;
  ultima?: boolean;
  children: React.ReactNode;
}> = ({ icono, etiqueta, ultima, children }) => (
  <View
    style={[
      tw`flex-row items-center justify-between ${ultima ? '' : 'border-b border-silver'}`,
      { minHeight: ALTO_FILA },
    ]}
  >
    <View style={tw`w-6 items-center mr-3`}>
      <Feather name={icono} size={18} color={Colors.silver} />
    </View>
    <Text style={[tipografia.texto, tw`flex-1 mr-3`]}>{etiqueta}</Text>
    {children}
  </View>
);

export interface PreferenciasProps {
  errorFuera?: boolean;
}

export const Preferencias: React.FC<PreferenciasProps> = ({ errorFuera = false }) => {
  useIdioma();
  const tema = useTema();
  const biometria = usePreferencias((estado) => estado.biometria);
  const accesibilidad = usePreferencias((estado) => estado.accesibilidad);
  const [errorLocal, setErrorLocal] = useState<ClaveLiteral | null>(null);
  const errorPublicado = usePreferencias((estado) => estado.errorBloqueo);
  const error = errorFuera ? errorPublicado : errorLocal;
  const setError = (clave: ClaveLiteral | null) =>
    errorFuera ? usePreferencias.setState({ errorBloqueo: clave }) : setErrorLocal(clave);
  const pendiente = errorFuera && errorPublicado === ERROR_BLOQUEO_PENDIENTE;
  const [metodo, setMetodo] = useState<MetodoBloqueo | null>(null);

  useEffect(() => {
    let activo = true;
    Biometria.metodo().then((encontrado) => activo && setMetodo(encontrado));
    return () => {
      activo = false;
      if (errorFuera) usePreferencias.setState({ errorBloqueo: null });
    };
  }, [errorFuera]);

  const cambiarAccesibilidad = (activa: boolean) => {
    setAccesibilidad(activa);
    StorageService.saveAccesibilidad(activa).catch((e) => LogService.warn('[Preferencias] No se pudo guardar la accesibilidad', e));
  };

  const guardar = (activa: boolean) => {
    setBiometria(activa);
    if (activa) marcarDesbloqueada(true);
    StorageService.saveBiometria(activa).catch((e) => LogService.warn('[Preferencias] No se pudo guardar la biometría', e));
  };

  const cambiarBloqueo = async (quiere: boolean) => {
    setError(null);
    if (!quiere) return guardar(false);

    const disponible = await Biometria.metodo();
    setMetodo(disponible);
    if (disponible === 'ninguno') return setError('pl_bloqueo_sin_metodo');
    if (!(await Biometria.autenticar())) return setError(errorFuera ? ERROR_BLOQUEO_PENDIENTE : 'pl_biometria_fallida');
    guardar(true);
  };

  const etiqueta = t(
    metodo === 'biometria' ? 'pl_bloqueo_huella' : metodo === 'credencial' ? 'pl_bloqueo_credencial' : 'pl_bloqueo_app'
  );

  return (
    <View style={tw`border-t border-silver`}>
      <Fila icono="globe" etiqueta={t('pl_idioma')}>
        <SelectorIdioma />
      </Fila>
      <Fila icono={tema === 'oscuro' ? 'moon' : 'sun'} etiqueta={t('pl_tema')}>
        <SelectorTema />
      </Fila>
      <Fila icono="lock" etiqueta={etiqueta}>
        <Interruptor testID="interruptor-biometria" valor={biometria || pendiente} onChange={cambiarBloqueo} />
      </Fila>
      <Fila icono="eye" etiqueta={t('pl_accesibilidad')} ultima>
        <Interruptor testID="interruptor-accesibilidad" valor={accesibilidad} onChange={cambiarAccesibilidad} />
      </Fila>
      {error && !errorFuera ? (
        <Text testID="error-biometria" style={[tipografia.error, tw`pb-3`]}>
          {t(error)}
        </Text>
      ) : null}
    </View>
  );
};
