import { DomainError } from './domain.error';

/** Un recurso del dominio no existe (o no es accesible públicamente). */
export class NotFoundError extends DomainError {
  readonly code: string;

  constructor(resource: string, identifier?: string) {
    super(
      identifier === undefined
        ? `${resource} no encontrado`
        : `${resource} con id "${identifier}" no encontrado`,
    );
    this.code = `${resource.toUpperCase().replace(/\s+/g, '_')}_NOT_FOUND`;
  }
}
