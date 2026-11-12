import { DomainError, NotFoundError, RuleViolationError } from '../../../../shared/domain/errors';

/** El proveedor no figura entre los habilitados por `INTEGRATIONS_ENABLED` (→ 404). */
export class UnknownProviderError extends NotFoundError {
  constructor(provider: string) {
    super('Integración', provider);
    (this as { code: string }).code = 'INTEGRATION_NOT_FOUND';
  }
}

/** El proveedor está pausado a mano: no se encolan trabajos nuevos (→ 422). */
export class ProviderDisabledError extends RuleViolationError {
  readonly code = 'INTEGRATION_DISABLED';

  constructor(provider: string) {
    super(`La integración "${provider}" está pausada: reanudala antes de sincronizar`);
  }
}

/** El secreto de este proveedor viene de una variable de entorno (→ 422, D14). */
export class CredentialFromEnvError extends RuleViolationError {
  readonly code = 'INTEGRATION_CREDENTIAL_FROM_ENV';

  constructor() {
    super('La credencial de este proveedor viene de una variable de entorno');
  }
}

/** Una transición que la máquina de estados del trabajo no permite. */
export class InvalidJobTransitionError extends RuleViolationError {
  readonly code = 'INVALID_JOB_TRANSITION';

  constructor(from: string, action: string) {
    super(`Transición inválida del trabajo: ${action} desde ${from}`);
  }
}

/** No hay credencial para el proveedor (ni variable ni base). */
export class CredentialMissingError extends DomainError {
  readonly code = 'INTEGRATION_CREDENTIAL_MISSING';

  constructor() {
    super('falta la credencial');
  }
}

/** La credencial guardada no se puede descifrar (clave ausente, dato asociado o tag inválidos). */
export class CredentialUnreadableError extends DomainError {
  readonly code = 'INTEGRATION_CREDENTIAL_UNREADABLE';

  constructor() {
    super('credencial ilegible: reingresala o corré integrations:rekey');
  }
}
