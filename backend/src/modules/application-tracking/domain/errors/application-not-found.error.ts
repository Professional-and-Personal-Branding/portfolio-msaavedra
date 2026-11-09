import { NotFoundError } from '../../../../shared/domain/errors';

export class ApplicationNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Postulación', id);
  }
}
