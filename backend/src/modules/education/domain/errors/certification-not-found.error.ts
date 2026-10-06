import { NotFoundError } from '../../../../shared/domain/errors';

export class CertificationNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Certificación', id);
  }
}
