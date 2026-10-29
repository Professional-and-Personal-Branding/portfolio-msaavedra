import { profilePath } from '@/shared/lib/profile-link';

/**
 * Portales sugeridos al crear un enlace o copiar un link genérico (D11 de `add-share-links`).
 * Son sugerencias: al crear un enlace se acepta cualquier texto normalizable.
 */
export const PORTAL_SUGGESTIONS = [
  'linkedin',
  'indeed',
  'computrabajo',
  'getonbrd',
  'upwork',
  'torre',
  'email',
] as const;

/** Misma regla que el servidor (`normalizeSource`): el panel solo avisa, el servidor decide. */
const PORTAL_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;

/** Portal normalizado (recortado y en minúsculas) o `null` si el servidor lo rechazaría. */
export function normalizePortal(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  return PORTAL_PATTERN.test(value) ? value : null;
}

export interface ShareUrlContext {
  /** Origen del sitio (`location.origin`). */
  origin: string;
  slug: string;
  /** Solo se agrega si el perfil es `PROTECTED` y tiene token. */
  token: string | null;
}

function build(context: ShareUrlContext, attribution: Record<string, string>): string {
  const params = new URLSearchParams();
  // El token va antes: el link que se envía abre el perfil protegido sin pedirlo.
  if (context.token) params.set('token', context.token);
  for (const [name, value] of Object.entries(attribution)) params.set(name, value);
  return `${context.origin}${profilePath(context.slug)}?${params.toString()}`;
}

/** URL absoluta con el código del enlace (`?via=`), después de `token` si el perfil es `PROTECTED`. */
export function shareLinkUrl(context: ShareUrlContext, code: string): string {
  return build(context, { via: code });
}

/** URL genérica por portal (`?src=`), sin enlace ni llamada a la API. */
export function portalLinkUrl(context: ShareUrlContext, portal: string): string {
  return build(context, { src: portal });
}

/** Página de compartir de LinkedIn con la URL del perfil ya codificada. */
export function linkedInShareUrl(profileUrl: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}`;
}

/** Lo que el bloque necesita del perfil guardado (nunca del borrador: los links usan lo guardado). */
export interface SavedProfileRef {
  id: string;
  slug: string;
  visibility: 'PUBLIC' | 'PRIVATE' | 'PROTECTED';
  accessToken: string | null;
  archivedAt: string | null;
}

/** Contexto para armar las URLs: el token solo viaja en un perfil `PROTECTED`. */
export function urlContextOf(profile: SavedProfileRef): ShareUrlContext {
  return {
    origin: globalThis.location?.origin ?? '',
    slug: profile.slug,
    token: profile.visibility === 'PROTECTED' ? profile.accessToken : null,
  };
}

/** Por qué el botón no está disponible, o `null` si lo está (D12 de `add-share-links`). */
export function linkedInDisabledReason(profile: SavedProfileRef | undefined): string | null {
  if (!profile) return 'Guardá el perfil primero para compartirlo.';
  if (profile.archivedAt) return 'El perfil está archivado: su link responde 404.';
  if (profile.visibility === 'PROTECTED') {
    return 'El perfil es protegido: el link incluiría el token y publicarlo en LinkedIn lo expondría.';
  }
  if (profile.visibility !== 'PUBLIC') return 'Solo un perfil público se puede compartir.';
  return null;
}
