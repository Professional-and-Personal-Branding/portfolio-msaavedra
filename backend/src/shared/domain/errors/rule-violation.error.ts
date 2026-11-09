import { DomainError } from './domain.error';

/**
 * La petición está bien formada pero viola una regla del dominio, por ejemplo una transición de
 * estado que la máquina no permite (→ 422). Es la base: cada módulo declara su subclase con el
 * `code` que corresponda. La validación de entrada sigue siendo `ValidationError` (→ 400).
 */
export abstract class RuleViolationError extends DomainError {
  protected constructor(message: string) {
    super(message);
  }
}
