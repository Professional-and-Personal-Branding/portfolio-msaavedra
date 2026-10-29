import { Result } from '../../../../shared/domain/result';
import { NewShareLinkProps, ShareLink } from '../entities/share-link.entity';
import { ShareCodeCollisionError } from '../errors/share-code-collision.error';

export const SHARE_LINK_REPOSITORY = Symbol('ShareLinkRepository');

export interface ShareLinkRepository {
  /** Por código ya normalizado (índice único); cualquier estado. */
  findByCode(code: string): Promise<ShareLink | null>;
  findById(id: string): Promise<ShareLink | null>;
  /** Más recientes primero. */
  listByProfile(curatedProfileId: string): Promise<ShareLink[]>;
  /** Falla con `ShareCodeCollisionError` si el código ya existe. */
  create(props: NewShareLinkProps): Promise<Result<ShareLink, ShareCodeCollisionError>>;
  /** Persiste la etiqueta y la revocación; null si el enlace ya no existe. */
  save(link: ShareLink): Promise<ShareLink | null>;
  /** El `LINKEDIN_POST` activo más reciente del perfil. */
  findActiveLinkedIn(curatedProfileId: string): Promise<ShareLink | null>;
}
