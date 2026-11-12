import { NotFoundError } from '../../../../shared/domain/errors';

export class FeaturedRepositoryNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Repositorio destacado', id);
  }
}
