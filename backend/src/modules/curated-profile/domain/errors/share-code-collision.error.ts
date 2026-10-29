import { DomainError } from '../../../../shared/domain/errors';

/** El código generado ya lo usa otro enlace: el caso de uso reintenta con otro. */
export class ShareCodeCollisionError extends DomainError {
  readonly code = 'SHARE_CODE_COLLISION';

  constructor() {
    super('El código del enlace ya existe');
  }
}
