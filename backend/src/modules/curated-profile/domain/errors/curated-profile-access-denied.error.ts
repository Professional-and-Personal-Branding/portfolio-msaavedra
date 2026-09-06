import { AccessDeniedError } from '../../../../shared/domain/errors';

/** Perfil PROTECTED sin token o con token que no coincide. */
export class CuratedProfileAccessDeniedError extends AccessDeniedError {
  constructor() {
    super('Perfil curado', 'token de acceso requerido o inválido');
  }
}
