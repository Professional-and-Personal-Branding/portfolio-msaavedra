import { fail, ok, Result } from '../../../shared/domain/result';
import { InvalidAiRunTransitionError } from './errors/ai.errors';
import { LlmUsage } from './estimate-cost';

export type AiRunStatus =
  'RESERVED' | 'SUCCEEDED' | 'CACHED' | 'REFUSED' | 'FAILED' | 'ABANDONED' | 'BLOCKED';

/** Estados finales a los que puede pasar una corrida `RESERVED`. */
export type AiRunFinalStatus = 'SUCCEEDED' | 'REFUSED' | 'FAILED' | 'ABANDONED';

export interface AiRunProps {
  readonly id: string;
  readonly task: string;
  readonly promptVersion: number;
  readonly model: string;
  readonly inputHash: string;
  readonly cacheKey: string;
  readonly status: AiRunStatus;
  readonly reservedMicroUsd: number;
  readonly costMicroUsd: number | null;
  readonly usage: LlmUsage | null;
  readonly stopReason: string | null;
  readonly failureKind: string | null;
  readonly failureMessage: string | null;
  readonly output: unknown;
  readonly requestId: string | null;
  readonly durationMs: number | null;
  readonly budgetMonth: string;
  readonly reservationExpiresAt: Date | null;
  readonly createdAt: Date;
  readonly finishedAt: Date | null;
}

export interface AiRunFinish {
  readonly status: AiRunFinalStatus;
  readonly costMicroUsd: number;
  readonly usage?: LlmUsage;
  readonly stopReason?: string;
  readonly failureKind?: string;
  readonly failureMessage?: string;
  readonly output?: unknown;
  readonly requestId?: string | null;
  readonly durationMs: number;
  readonly finishedAt: Date;
}

export interface AiRunIdentity {
  readonly id: string;
  readonly task: string;
  readonly promptVersion: number;
  readonly model: string;
  readonly inputHash: string;
  readonly cacheKey: string;
  readonly budgetMonth: string;
  readonly now: Date;
}

/**
 * Una corrida de IA (D6). `RESERVED` es el único estado no terminal: pasa a `SUCCEEDED`, `REFUSED`,
 * `FAILED` o `ABANDONED`. `CACHED` y `BLOCKED` nacen terminales (costo 0, sin llamada). Inmutable:
 * cada transición devuelve una corrida nueva, o `fail` si la transición no es válida.
 */
export class AiRun {
  private constructor(readonly props: AiRunProps) {}

  static restore(props: AiRunProps): AiRun {
    return new AiRun(props);
  }

  private static base(identity: AiRunIdentity): AiRunProps {
    return {
      id: identity.id,
      task: identity.task,
      promptVersion: identity.promptVersion,
      model: identity.model,
      inputHash: identity.inputHash,
      cacheKey: identity.cacheKey,
      status: 'RESERVED',
      reservedMicroUsd: 0,
      costMicroUsd: null,
      usage: null,
      stopReason: null,
      failureKind: null,
      failureMessage: null,
      output: null,
      requestId: null,
      durationMs: null,
      budgetMonth: identity.budgetMonth,
      reservationExpiresAt: null,
      createdAt: identity.now,
      finishedAt: null,
    };
  }

  static reserved(
    identity: AiRunIdentity,
    reservedMicroUsd: number,
    reservationExpiresAt: Date,
  ): AiRun {
    return new AiRun({
      ...AiRun.base(identity),
      status: 'RESERVED',
      reservedMicroUsd,
      reservationExpiresAt,
    });
  }

  /** Corrida servida desde la caché: terminal, sin llamada y sin costo. */
  static cached(identity: AiRunIdentity, output: unknown): AiRun {
    return new AiRun({
      ...AiRun.base(identity),
      status: 'CACHED',
      costMicroUsd: 0,
      output,
      durationMs: 0,
      finishedAt: identity.now,
    });
  }

  /** Intento cortado antes de llamar (presupuesto, frontera de datos, entrada enorme). */
  static blocked(identity: AiRunIdentity, failureKind: string, failureMessage: string): AiRun {
    return new AiRun({
      ...AiRun.base(identity),
      status: 'BLOCKED',
      costMicroUsd: 0,
      failureKind,
      failureMessage,
      durationMs: 0,
      finishedAt: identity.now,
    });
  }

  /** Falló antes de reservar (p. ej. el conteo de tokens): terminal y sin costo. */
  static failedBeforeReserve(
    identity: AiRunIdentity,
    failureKind: string,
    failureMessage: string,
    durationMs: number,
  ): AiRun {
    return new AiRun({
      ...AiRun.base(identity),
      status: 'FAILED',
      costMicroUsd: 0,
      failureKind,
      failureMessage,
      durationMs,
      finishedAt: identity.now,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get status(): AiRunStatus {
    return this.props.status;
  }

  /** Cierra una corrida `RESERVED`; cualquier otro origen es una transición inválida. */
  finish(finish: AiRunFinish): Result<AiRun, InvalidAiRunTransitionError> {
    if (this.props.status !== 'RESERVED') {
      return fail(new InvalidAiRunTransitionError(this.props.status, finish.status));
    }
    return ok(
      new AiRun({
        ...this.props,
        status: finish.status,
        costMicroUsd: finish.costMicroUsd,
        usage: finish.usage ?? this.props.usage,
        stopReason: finish.stopReason ?? null,
        failureKind: finish.failureKind ?? null,
        failureMessage: finish.failureMessage ?? null,
        output: finish.output ?? null,
        requestId: finish.requestId ?? null,
        durationMs: finish.durationMs,
        finishedAt: finish.finishedAt,
      }),
    );
  }
}
