import { NotFoundError } from '../../../../shared/domain/errors';

export class JobPostingNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Vacante', id);
  }
}
