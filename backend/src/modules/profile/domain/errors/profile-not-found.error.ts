import { NotFoundError } from '../../../../shared/domain/errors';

export class ProfileNotFoundError extends NotFoundError {
  constructor() {
    super('Perfil');
  }
}
