/**
 * Ejecuta `callback` en el primer momento ocioso **después** del evento `load` (o ya, si el
 * documento terminó de cargar): `requestIdleCallback` con un tope de `timeoutMs`, o
 * `setTimeout` donde no exista (Safari). Sirve para traer lo que no hace falta para pintar
 * sin competir con el arranque. Devuelve cómo cancelarlo.
 */
export function afterLoadIdle(callback: () => void, timeoutMs = 2000): () => void {
  let cancelled = false;
  let cancelPending: (() => void) | undefined;

  const schedule = () => {
    if (cancelled) return;
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(callback, { timeout: timeoutMs });
      cancelPending = () => window.cancelIdleCallback(handle);
    } else {
      const handle = window.setTimeout(callback, 0);
      cancelPending = () => window.clearTimeout(handle);
    }
  };

  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });

  return () => {
    cancelled = true;
    window.removeEventListener('load', schedule);
    cancelPending?.();
  };
}
