import { AccessDeniedError } from '../../../../shared/domain/errors';

/** La contraseña actual enviada en el cambio no coincide. Mensaje genérico, sin detalle del hash. */
export class InvalidCurrentPasswordError extends AccessDeniedError {
  constructor() {
    super('Backoffice', 'credenciales incorrectas');
  }
}
