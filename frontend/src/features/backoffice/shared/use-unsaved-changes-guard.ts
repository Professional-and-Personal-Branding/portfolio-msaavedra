import { useLayoutEffect, useRef } from 'react';
import { useBlocker, type Blocker } from 'react-router';
import { useWarnBeforeUnload } from './use-warn-before-unload';

/** Ruta del fin de sesión: sin sesión el borrador ya no puede guardarse (P2). */
const LOGIN_PATH = '/admin/login';

export interface UnsavedChangesGuard {
  blocker: Blocker;
  /**
   * Marca el borrador como guardado de forma síncrona. Hace falta cuando el guardado
   * navega en el mismo tic (alta de un perfil): una clausura sobre `dirty` vería el valor viejo.
   */
  markSaved: () => void;
}

/**
 * Pide confirmación antes de descartar cambios (spec `curated-profile-builder` § Aviso
 * antes de descartar un borrador sin guardar): `beforeunload` al recargar o cerrar, y un
 * bloqueo del router solo cuando cambia el `pathname` (la query y `/admin/login` pasan).
 */
export function useUnsavedChangesGuard(dirty: boolean): UnsavedChangesGuard {
  const dirtyRef = useRef(dirty);
  // Sincronizada al confirmar el render (no durante él): el blocker lee siempre el último valor.
  useLayoutEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useWarnBeforeUnload(dirty);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirtyRef.current &&
      currentLocation.pathname !== nextLocation.pathname &&
      nextLocation.pathname !== LOGIN_PATH,
  );

  return {
    blocker,
    markSaved: () => {
      dirtyRef.current = false;
    },
  };
}
