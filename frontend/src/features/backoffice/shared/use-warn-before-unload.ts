import { useEffect } from 'react';

/** Aviso nativo del navegador al recargar o cerrar la pestaña mientras `active`. */
export function useWarnBeforeUnload(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [active]);
}
