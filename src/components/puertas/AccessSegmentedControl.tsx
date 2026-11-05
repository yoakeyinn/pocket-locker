import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Selector } from '../Selector';
import { Text } from '../../styles/tipografia/Tipografia';
import tw, { tipografia } from '../../styles/styles';
import { Puerta } from '../../services/comun';

export interface AccessSegmentedControlProps {
  pestanaActiva: Puerta;
  onSelect: (puerta: Puerta) => void;
  tieneAmbas?: boolean;
}

const NOMBRES: Record<Puerta, string> = { peatonal: 'Puerta Peatonal', garaje: 'Portón de Garaje' };

export const AccessSegmentedControl: React.FC<AccessSegmentedControlProps> = ({
  pestanaActiva,
  onSelect,
  tieneAmbas = true,
}) => {
  const { width } = useWindowDimensions();
  const ancho = Math.max(100, Math.min(150, Math.floor((width - 40 - 8) / 2)));

  return !tieneAmbas ? (
    <View style={tw`px-5 py-2 rounded-lg border border-silver`}>
      <Text style={[tipografia.texto, tw`text-xs`]}>{NOMBRES[pestanaActiva]}</Text>
    </View>
  ) : (
    <Selector
      id="puerta"
      ancho={ancho}
      valor={pestanaActiva}
      onChange={onSelect}
      opciones={[
        { valor: 'peatonal', etiqueta: NOMBRES.peatonal },
        { valor: 'garaje', etiqueta: NOMBRES.garaje },
      ]}
    />
  );
};
