import { AccessDeniedError } from '../../../../shared/domain/errors';

/** La sesión ya no vale: el administrador no existe o su `sessionVersion` cambió. */
export class SessionRevokedError extends AccessDeniedError {
  constructor() {
    super('Backoffice', 'sesión inválida');
  }
}
