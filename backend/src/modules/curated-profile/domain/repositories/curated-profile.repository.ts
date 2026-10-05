import { CuratedProfile, NewCuratedProfileProps } from '../entities/curated-profile.entity';

export const CURATED_PROFILE_REPOSITORY = Symbol('CuratedProfileRepository');

export interface CuratedProfileRepository {
  /** Perfil por slug vigente, cualquiera sea su estado (la regla de acceso la aplica el dominio). */
  findBySlug(slug: string): Promise<CuratedProfile | null>;
  /**
   * Perfil por slug vigente o, si no hay, por un slug anterior (alias). El perfil
   * devuelto trae su slug canónico: si difiere del pedido, se resolvió por alias.
   */
  findBySlugOrAlias(slug: string): Promise<CuratedProfile | null>;
  /** Perfiles PUBLIC, ordenados por fecha de creación ascendente. */
  findAllPublic(): Promise<CuratedProfile[]>;

  /** Todos, cualquier visibilidad, por fecha de creación (backoffice). */
  findAll(): Promise<CuratedProfile[]>;
  findById(id: string): Promise<CuratedProfile | null>;
  /**
   * true si otro perfil (distinto de `excludeId`) ya usa el slug, como vigente o
   * como alias. Un perfil puede volver a su propio slug anterior.
   */
  existsBySlug(slug: string, excludeId?: string): Promise<boolean>;
  create(props: NewCuratedProfileProps): Promise<CuratedProfile>;
  /**
   * Persiste el estado completo; null si ya no existe. Si el slug cambió, registra
   * el anterior como alias y elimina el alias del slug nuevo, en la misma transacción.
   */
  update(profile: CuratedProfile): Promise<CuratedProfile | null>;
  /** Borra el perfil y sus visitas; true si existía. */
  delete(id: string): Promise<boolean>;
}
