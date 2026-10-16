import type { Locale } from '@/shared/i18n/locale';
import { API_BASE_URL } from '@/shared/lib/api-client';

/** Lo que deja `public/profile-prefetch.js` en el `<head>` (D5 de `improve-mobile-performance`). */
export interface EarlyProfile {
  key: string;
  response: Promise<Response>;
}

declare global {
  interface Window {
    __portfolioEarlyProfile?: EarlyProfile;
  }
}

/** Misma clave que arma el script: `JSON.stringify([slug, locale, token])`. */
export function earlyProfileKey(slug: string, locale: Locale, token: string | null): string {
  return JSON.stringify([slug, locale, token]);
}

/**
 * Toma la respuesta de la petición temprana del perfil, **una sola vez**: la global se borra al
 * primer intento, coincida o no (un reintento o una segunda consulta piden por su cuenta). Solo
 * se usa si la clave es exactamente la de la consulta y la API es del mismo origen (el script
 * pide una ruta relativa).
 */
export function takeEarlyProfile(
  slug: string,
  locale: Locale,
  token: string | null,
): Promise<Response> | undefined {
  const early = globalThis.window?.__portfolioEarlyProfile;
  if (!early) return undefined;
  delete window.__portfolioEarlyProfile;
  if (API_BASE_URL !== '' || early.key !== earlyProfileKey(slug, locale, token)) return undefined;
  return early.response;
}
