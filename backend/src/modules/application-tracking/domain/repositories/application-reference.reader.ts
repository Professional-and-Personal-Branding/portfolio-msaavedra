export const APPLICATION_REFERENCE_READER = Symbol('ApplicationReferenceReader');

export interface ReferencedProfile {
  readonly id: string;
  readonly slug: string;
}

export interface ReferencedShareLink {
  readonly id: string;
  readonly curatedProfileId: string;
  readonly kind: 'MANUAL' | 'LINKEDIN_POST';
  readonly label: string;
  readonly code: string;
  readonly revokedAt: Date | null;
}

/**
 * Lectura mínima del perfil y del enlace a los que apunta una postulación (D1): dos campos de
 * cada uno, sin acoplar el CRM a las entidades completas de `curated-profile`. Solo lee.
 */
export interface ApplicationReferenceReader {
  findProfile(id: string): Promise<ReferencedProfile | null>;
  findShareLink(id: string): Promise<ReferencedShareLink | null>;
}
