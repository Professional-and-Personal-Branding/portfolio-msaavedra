import { NotFoundError } from '../../../../shared/domain/errors';

export class ExperienceNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Experiencia', id);
  }
}
