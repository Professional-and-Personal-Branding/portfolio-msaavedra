import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { writeUrlState } from './url-state';

export interface ProfileLink {
  pathname: string;
  search: string;
}

/** El perfil curado que se sirve en la home (`/`). */
export const HOME_SLUG = 'all';

export function profilePath(slug: string): string {
  return slug === HOME_SLUG ? '/' : `/${slug}`;
}

/**
 * Enlace a un perfil curado conservando idioma/tema/layout de la URL actual.
 * El `token` no viaja: pertenece al perfil que lo emitió. `via` y `src` tampoco: atribuyen la
 * visita al link que se abrió, no la navegación interna (change `add-share-links`).
 */
export function buildProfileLink(slug: string, params: URLSearchParams): ProfileLink {
  return {
    pathname: profilePath(slug),
    search: writeUrlState(params, { token: null, via: null, src: null }).toString(),
  };
}

export function useProfileLink(slug: string): ProfileLink {
  const [params] = useSearchParams();
  return useMemo(() => buildProfileLink(slug, params), [slug, params]);
}
