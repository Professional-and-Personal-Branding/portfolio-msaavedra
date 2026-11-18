import { DomainError, RuleViolationError } from '../../../../shared/domain/errors';

/** La IA está apagada en este servidor (`AI_ENABLED=false`) (→ 422). */
export class AiDisabledError extends RuleViolationError {
  readonly code = 'AI_DISABLED';

  constructor() {
    super('La IA está apagada en este servidor');
  }
}

/** El tope mensual de IA no admite la reserva, o el proveedor cortó por su spend limit (→ 422). */
export class AiBudgetExhaustedError extends RuleViolationError {
  readonly code = 'AI_BUDGET_EXHAUSTED';
  /** `cap`: el tope propio de `AI_MONTHLY_BUDGET_USD`; `provider`: el spend limit de Anthropic. */
  readonly reason: 'cap' | 'provider';
  readonly blockedUntil: Date | null;

  private constructor(reason: 'cap' | 'provider', blockedUntil: Date | null, message: string) {
    super(message);
    this.reason = reason;
    this.blockedUntil = blockedUntil;
  }

  static cap(): AiBudgetExhaustedError {
    return new AiBudgetExhaustedError('cap', null, 'Se alcanzó el tope de IA del mes');
  }

  static provider(until: Date): AiBudgetExhaustedError {
    return new AiBudgetExhaustedError(
      'provider',
      until,
      `Anthropic cortó por el spend limit hasta ${until.toISOString()}`,
    );
  }
}

/** La entrada estimada supera `AI_MAX_INPUT_TOKENS` (→ 422). */
export class AiInputTooLargeError extends RuleViolationError {
  readonly code = 'AI_INPUT_TOO_LARGE';

  constructor(estimated: number, max: number) {
    super(`La entrada de IA es demasiado grande (${estimated} tokens estimados, máximo ${max})`);
  }
}

/** No hay lugar en el semáforo de llamadas simultáneas (→ 503 con `retry-after`). */
export class AiBusyError extends DomainError {
  readonly code = 'AI_BUSY';
  readonly retryAfterSeconds = 5;

  constructor() {
    super('Hay demasiadas consultas de IA en curso; esperá unos segundos');
  }
}

/**
 * El payload trae un dato que no puede salir hacia el proveedor (→ 422). `reason` nombra la clave
 * o el patrón, NUNCA el valor.
 */
export class ForbiddenDataError extends RuleViolationError {
  readonly code = 'AI_FORBIDDEN_DATA';
  readonly reason: string;

  constructor(reason: string) {
    super(`La entrada de IA incluye un dato que no puede enviarse (${reason})`);
    this.reason = reason;
  }
}

/** Transición que la máquina de estados de `AiRun` no permite. */
export class InvalidAiRunTransitionError extends DomainError {
  readonly code = 'AI_RUN_INVALID_TRANSITION';

  constructor(from: string, to: string) {
    super(`Transición inválida de la corrida de IA: ${from} → ${to}`);
  }
}
