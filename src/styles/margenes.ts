import { createContext, useContext } from 'react';
import * as SafeArea from 'react-native-safe-area-context';

const SIN_MARGENES = { top: 0, bottom: 0, left: 0, right: 0 };

const ContextoMargenes = SafeArea.SafeAreaInsetsContext ?? createContext<typeof SIN_MARGENES | null>(null);

export function useMargenesSeguros() {
  return useContext(ContextoMargenes) ?? SIN_MARGENES;
}
