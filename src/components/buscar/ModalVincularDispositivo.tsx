import React from 'react';
import { View } from 'react-native';
import { Campo } from '../Campo';
import { Cargando } from '../Cargando';
import { Modal } from '../Modal';
import { DEFAULT_SECURITY_PIN } from '../../services/comun';
import { estaSimulando } from '../../services/Simulacion';
import { Text } from '../../styles/tipografia/Tipografia';
import { t } from '../../styles/i18n';
import tw from '../../styles/styles';

export interface ModalVincularDispositivoProps {
  visible: boolean;
  guardando: boolean;
  nombrePersonalizado: string;
  setNombrePersonalizado: (val: string) => void;
  errorNombre?: string | null;
  pinSeguridad: string;
  setPinSeguridad: (val: string) => void;
  errorPin?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ModalVincularDispositivo: React.FC<ModalVincularDispositivoProps> = ({
  visible,
  guardando,
  nombrePersonalizado,
  setNombrePersonalizado,
  errorNombre,
  pinSeguridad,
  setPinSeguridad,
  errorPin,
  onCancel,
  onConfirm,
}) => {
  const app = t('pl_app_titulo');
  const simulando = estaSimulando();
  return (
    <Modal
      visible={visible}
      titulo={t('pl_vincular_dispositivo')}
      mensaje={
        simulando
          ? t('pl_vincular_pin_mensaje_simulacion', { pin: DEFAULT_SECURITY_PIN, app })
          : t('pl_vincular_pin_mensaje', { app })
      }
      izquierdo={{ texto: t('pl_cancelar'), onPress: onCancel, deshabilitado: guardando }}
      derecho={{ texto: t('pl_vincular'), onPress: onConfirm, deshabilitado: guardando }}
      onCerrar={onCancel}
    >
      <Campo
        id="nombre"
        etiqueta={t('pl_nombre_dispositivo')}
        error={errorNombre}
        value={nombrePersonalizado}
        onChangeText={setNombrePersonalizado}
        maxLength={24}
      />
      <Campo
        id="pin"
        clase="mt-4"
        etiqueta={t('pl_pin_seguridad')}
        error={errorPin}
        value={pinSeguridad}
        onChangeText={setPinSeguridad}
        autoCapitalize="characters"
        maxLength={9}
      />

      {guardando && (
        <View style={tw`flex-row items-center mt-4`}>
          <Cargando tamano={20} />
          <Text style={tw`text-xs font-light text-gray ml-2.5 flex-1 leading-4`}>
            {simulando ? t('pl_vinculando_ayuda_simulacion', { pin: DEFAULT_SECURITY_PIN }) : t('pl_vinculando_ayuda')}
          </Text>
        </View>
      )}
    </Modal>
  );
};
