import { create } from 'zustand';

export const useArranque = create<{ enCurso: boolean }>(() => ({ enCurso: false }));

export const marcarArranque = (enCurso: boolean): void => useArranque.setState({ enCurso });
