import { CuratedProfile } from '../entities/curated-profile.entity';

export const CURATED_PROFILE_REPOSITORY = Symbol('CuratedProfileRepository');

export interface CuratedProfileRepository {
  /** Perfil por slug, cualquiera sea su visibilidad (la regla de acceso la aplica el dominio). */
  findBySlug(slug: string): Promise<CuratedProfile | null>;
  /** Perfiles PUBLIC, ordenados por fecha de creación ascendente. */
  findAllPublic(): Promise<CuratedProfile[]>;
}
