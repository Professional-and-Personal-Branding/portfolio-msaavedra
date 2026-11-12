import { fail, ok, Result } from '../../../../shared/domain/result';
import { InvalidJobTransitionError } from '../errors/integration.errors';
import { ProviderFailure } from '../provider-failure';
import { hintMargin, nextRetryDelay } from '../services/next-retry-delay';

export type IntegrationJobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'DEAD';

/** Tabla de transiciones permitidas (D7). `RUNNING → RUNNING` no existe: el reclamo cuenta el intento. */
export const JOB_TRANSITIONS: Readonly<
  Record<IntegrationJobStatus, readonly IntegrationJobStatus[]>
> = {
  PENDING: ['RUNNING'],
  FAILED: ['RUNNING'],
  RUNNING: ['DONE', 'FAILED', 'DEAD', 'PENDING'],
  DONE: [],
  DEAD: [],
};

export interface IntegrationJobProps {
  readonly id: string;
  readonly provider: string;
  readonly kind: string;
  readonly idempotencyKey: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly status: IntegrationJobStatus;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly runAt: Date;
  readonly lockedBy: string | null;
  readonly lockedUntil: Date | null;
  readonly lastErrorClass: string | null;
  readonly lastError: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly finishedAt: Date | null;
}

export const DEFAULT_MAX_ATTEMPTS = 8;

/**
 * Trabajo de la cola (D7). Inmutable: cada transición devuelve un trabajo nuevo o
 * `InvalidJobTransitionError`. El reclamo real es un `UPDATE` con `SKIP LOCKED`; `claim` modela
 * la misma transición para los dobles de test y deja la tabla completa en un solo lugar.
 */
export class IntegrationJob {
  constructor(readonly props: IntegrationJobProps) {}

  get id(): string {
    return this.props.id;
  }
  get provider(): string {
    return this.props.provider;
  }
  get status(): IntegrationJobStatus {
    return this.props.status;
  }
  get attempts(): number {
    return this.props.attempts;
  }

  private with(patch: Partial<IntegrationJobProps>, now: Date): IntegrationJob {
    return new IntegrationJob({ ...this.props, ...patch, updatedAt: now });
  }

  private guard(to: IntegrationJobStatus, action: string): InvalidJobTransitionError | null {
    return JOB_TRANSITIONS[this.props.status].includes(to)
      ? null
      : new InvalidJobTransitionError(this.props.status, action);
  }

  /** `PENDING`/`FAILED` → `RUNNING`: cuenta el intento y toma el lock. */
  claim(
    holder: string,
    now: Date,
    lockMs: number,
  ): Result<IntegrationJob, InvalidJobTransitionError> {
    const error = this.guard('RUNNING', 'claim');
    if (error) return fail(error);
    return ok(
      this.with(
        {
          status: 'RUNNING',
          lockedBy: holder,
          lockedUntil: new Date(now.getTime() + lockMs),
          attempts: this.props.attempts + 1,
        },
        now,
      ),
    );
  }

  /** `RUNNING` → `DONE`. */
  complete(now: Date): Result<IntegrationJob, InvalidJobTransitionError> {
    const error = this.guard('DONE', 'complete');
    if (error) return fail(error);
    return ok(
      this.with(
        {
          status: 'DONE',
          lockedBy: null,
          lockedUntil: null,
          lastErrorClass: null,
          lastError: null,
          finishedAt: now,
        },
        now,
      ),
    );
  }

  /**
   * `RUNNING` → `FAILED` (con `runAt` por la pista o por D8) o `DEAD` (`Permanent`,
   * `BudgetExhausted` o intentos agotados). El mensaje ya debe venir redactado.
   */
  fail(
    failure: ProviderFailure,
    now: Date,
    random: () => number = Math.random,
  ): Result<IntegrationJob, InvalidJobTransitionError> {
    const target: IntegrationJobStatus = this.isTerminal(failure) ? 'DEAD' : 'FAILED';
    const error = this.guard(target, 'fail');
    if (error) return fail(error);
    const base = {
      lockedBy: null,
      lockedUntil: null,
      lastErrorClass: failure.kind,
      lastError: failure.message,
    };
    if (target === 'DEAD') return ok(this.with({ ...base, status: 'DEAD', finishedAt: now }, now));
    return ok(
      this.with({ ...base, status: 'FAILED', runAt: this.retryAt(failure, now, random) }, now),
    );
  }

  /** `RUNNING` → `PENDING` por apagado: no consume el intento (D6). */
  release(now: Date): Result<IntegrationJob, InvalidJobTransitionError> {
    const error = this.guard('PENDING', 'release');
    if (error) return fail(error);
    return ok(
      this.with(
        {
          status: 'PENDING',
          runAt: now,
          attempts: Math.max(0, this.props.attempts - 1),
          lockedBy: null,
          lockedUntil: null,
        },
        now,
      ),
    );
  }

  /** `RUNNING` con el lock vencido → `FAILED` o `DEAD` (recuperación al inicio de cada corrida). */
  expireLock(
    now: Date,
    random: () => number = Math.random,
  ): Result<IntegrationJob, InvalidJobTransitionError> {
    if (
      this.props.status !== 'RUNNING' ||
      this.props.lockedUntil === null ||
      this.props.lockedUntil.getTime() >= now.getTime()
    ) {
      return fail(new InvalidJobTransitionError(this.props.status, 'expireLock'));
    }
    return this.fail({ kind: 'Transient', message: 'lock vencido' }, now, random);
  }

  private isTerminal(failure: ProviderFailure): boolean {
    return (
      failure.kind === 'Permanent' ||
      failure.kind === 'BudgetExhausted' ||
      this.props.attempts >= this.props.maxAttempts
    );
  }

  private retryAt(failure: ProviderFailure, now: Date, random: () => number): Date {
    switch (failure.kind) {
      case 'RetryAfter':
        return new Date(now.getTime() + failure.seconds * 1000 + hintMargin(random));
      case 'ResetAt':
        return new Date(Math.max(now.getTime(), failure.at.getTime()) + hintMargin(random));
      default:
        return new Date(now.getTime() + nextRetryDelay(this.props.attempts, random));
    }
  }
}
