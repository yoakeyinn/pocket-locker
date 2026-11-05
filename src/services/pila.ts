const RUIDO =
  /recursivelyTraverse|reconnectPassiveEffects|commitHookEffectListMount|commitPassiveMount|flushPassiveEffects|flushPendingEffects|flushSyncWork|flushSpawnedWork|performSyncWorkOnRoot|performWorkOnRoot|commitRoot|completeRoot|runWithFiberInDEV|react_stack_bottom_frame|guardedLoadModule|loadModuleImplementation|metroRequire|batchedUpdates|dispatchEvent|dispatchNativeEvent|dispatchResponderEvent|processResponderEvent|onResponderRelease|_receiveSignal|_performTransitionSideEffects|InternalBytecode|\(native\)|skipping \d+ frames/;

export function compactarPila(pila: string | undefined, maximo: number = 8): string {
  if (!pila) return '';
  const utiles = pila
    .split('\n')
    .map((linea) => linea.trim())
    .filter((linea) => linea.startsWith('at ') && !RUIDO.test(linea))
    .map((linea) => linea.replace(/\((?:https?|file):\/\/[^)]*?:(\d+):(\d+)\)/, '($1:$2)'));
  const visibles = utiles.slice(0, maximo);
  if (utiles.length > maximo) visibles.push(`… (+${utiles.length - maximo} más)`);
  return visibles.join('\n');
}
