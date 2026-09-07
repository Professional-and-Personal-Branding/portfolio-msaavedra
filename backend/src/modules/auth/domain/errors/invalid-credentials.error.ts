import { AccessDeniedError } from '../../../../shared/domain/errors';

/** Mismo mensaje para email inexistente y contraseña incorrecta (no revela cuál falló). */
export class InvalidCredentialsError extends AccessDeniedError {
  constructor() {
    super('Backoffice', 'email o contraseña incorrectos');
  }
}
