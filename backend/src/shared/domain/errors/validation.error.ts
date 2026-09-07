import { DomainError } from './domain.error';

/** Regla de negocio violada por los datos de entrada (→ 400). */
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';

  constructor(
    message: string,
    /** Campo(s) implicados, para que el mensaje sea accionable. */
    readonly fields: readonly string[] = [],
  ) {
    super(message);
  }
}
