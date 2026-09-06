import { DomainError } from './domain.error';

/** El recurso existe pero exige una credencial que falta o no coincide. */
export class AccessDeniedError extends DomainError {
  readonly code: string;

  constructor(resource: string, reason = 'credencial requerida o inválida') {
    super(`Acceso denegado a ${resource}: ${reason}`);
    this.code = `${resource.toUpperCase().replace(/\s+/g, '_')}_ACCESS_DENIED`;
  }
}
