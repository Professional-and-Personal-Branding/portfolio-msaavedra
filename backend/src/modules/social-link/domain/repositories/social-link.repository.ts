import { NewSocialLinkProps, SocialLink } from '../entities/social-link.entity';

export const SOCIAL_LINK_REPOSITORY = Symbol('SocialLinkRepository');

/**
 * Puerto de persistencia de enlaces sociales. Lectura pública (solo visibles,
 * por `order` asc) + escritura del backoffice (add-profile-content-admin).
 */
export interface SocialLinkRepository {
  findAllVisible(): Promise<SocialLink[]>;

  /** Todos, incluidos los ocultos (backoffice), por `order` asc. */
  findAll(): Promise<SocialLink[]>;
  findById(id: string): Promise<SocialLink | null>;
  create(props: NewSocialLinkProps): Promise<SocialLink>;
  /** Persiste el estado completo de la entidad; null si ya no existe. */
  update(socialLink: SocialLink): Promise<SocialLink | null>;
  /** true si existía y fue borrado. */
  delete(id: string): Promise<boolean>;
}
