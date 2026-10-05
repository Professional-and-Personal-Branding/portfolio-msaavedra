/** Lo mínimo para decidir la enumeración, sea una entidad o una fila del sitemap. */
export interface ListingState {
  /** `CuratedVisibility`, o el texto crudo de una fila: lo que no sea `PUBLIC` no se enumera. */
  readonly visibility: string;
  readonly listed: boolean;
  readonly archivedAt: Date | null;
}

/**
 * El criterio único de enumeración (specs `public-curated-profile-api` y
 * `public-seo`): `PUBLIC`, `listed` y no archivado. Lo usan el listado público y
 * el sitemap, para que no puedan divergir. No decide el acceso por slug: eso es
 * `resolvability`.
 */
export function isPubliclyListed(profile: ListingState): boolean {
  return profile.visibility === 'PUBLIC' && profile.listed && profile.archivedAt === null;
}
