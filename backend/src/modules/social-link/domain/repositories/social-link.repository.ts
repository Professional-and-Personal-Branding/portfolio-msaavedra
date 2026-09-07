import { SocialLink } from '../entities/social-link.entity';

export const SOCIAL_LINK_REPOSITORY = Symbol('SocialLinkRepository');

/** Lectura pública: solo visibles, ordenados por `order` asc. */
export interface SocialLinkRepository {
  findAllVisible(): Promise<SocialLink[]>;
}
