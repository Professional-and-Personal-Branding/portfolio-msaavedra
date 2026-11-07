import { ConflictError } from '../../../../shared/domain/errors';

/** Un enlace solo puede estar en una postulación (D7): sus aperturas serían de otra persona. */
export class ShareLinkAlreadyTrackedError extends ConflictError {
  constructor() {
    super('Enlace de seguimiento', 'ya está asociado a otra postulación');
  }
}
