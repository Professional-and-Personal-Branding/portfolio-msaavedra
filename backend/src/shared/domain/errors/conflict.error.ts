import { DomainError } from './domain.error';

/** Conflicto con el estado existente, típicamente unicidad (→ 409). */
export class ConflictError extends DomainError {
  readonly code: string;

  constructor(resource: string, detail: string) {
    super(`${resource}: ${detail}`);
    this.code = `${resource.toUpperCase().replace(/\s+/g, '_')}_CONFLICT`;
  }
}
