/** Slug del perfil curado que sirve la home del sitio. */
export const HOME_SLUG = 'all';

/** Ruta pública de un perfil: la home es `all`. La comparten el sitemap, el head y el JSON Resume. */
export function profilePath(slug: string): string {
  return slug === HOME_SLUG ? '/' : `/${slug}`;
}
