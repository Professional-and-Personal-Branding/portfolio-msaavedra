import { NotFoundError } from '../../../../shared/domain/errors';

export class EducationNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Formación', id);
  }
}
