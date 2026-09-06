import { NotFoundError } from '../../../../shared/domain/errors';

/** Slug inexistente o perfil PRIVATE (no se revela la diferencia hacia afuera). */
export class CuratedProfileNotFoundError extends NotFoundError {
  constructor(slug: string) {
    super('Perfil curado', slug);
  }
}
