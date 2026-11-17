/**
 * Dobles de prueba de la base de IA (change `add-ai-foundation`): un almacén en memoria que
 * implementa los dos repositorios con la misma semántica que el SQL de Prisma, un `LlmPort`
 * guionado y utilidades de reloj, ids y logger. Ningún test llama a la API de Anthropic.
 */
import { Clock } from '../../src/shared/domain/clock';
import { fail, ok, Result } from '../../src/shared/domain/result';
import {
  AiBudgetRepository,
  AiRunRepository,
  BudgetMonthSnapshot,
  ReserveOutcome,
  ReserveRequest,
  SettleRequest,
} from '../../src/modules/ai/application/ports/ai-repositories';
import {
  AiRunLogEntry,
  AiRunLogger,
  AiSettings,
  ConcurrencyLimiter,
} from '../../src/modules/ai/application/ports/ai-support.ports';
import {
  LlmCompletion,
  LlmFailure,
  LlmPort,
  LlmRequest,
  ProviderLlmFailure,
} from '../../src/modules/ai/application/ports/llm.port';
import { AiRun } from '../../src/modules/ai/domain/ai-run.entity';

export class MutableClock implements Clock {
  constructor(private current: Date) {}
  now(): Date {
    return new Date(this.current.getTime());
  }
  set(date: Date): void {
    this.current = date;
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export function counterIds(prefix = 'run'): () => string {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

export class CapturingLogger implements AiRunLogger {
  readonly entries: AiRunLogEntry[] = [];
  log(entry: AiRunLogEntry): void {
    this.entries.push(entry);
  }
}

export class InstantLimiter implements ConcurrencyLimiter {
  acquire(): Promise<(() => void) | null> {
    return Promise.resolve(() => undefined);
  }
}

export class FullLimiter implements ConcurrencyLimiter {
  acquire(): Promise<(() => void) | null> {
    return Promise.resolve(null);
  }
}

export function aiSettings(overrides: Partial<AiSettings> = {}): AiSettings {
  return {
    enabled: true,
    provider: 'fake',
    monthlyBudgetUsd: 10,
    requestTimeoutMs: 60_000,
    maxConcurrency: 2,
    maxInputTokens: 50_000,
    knownSecrets: [],
    ...overrides,
  };
}

interface MonthRow {
  spent: number;
  reserved: number;
  blockedUntil: Date | null;
  blockReason: string | null;
}

/** Repositorios en memoria con la misma semántica que el SQL: una reserva solo entra si cabe. */
export class InMemoryAiStore implements AiRunRepository, AiBudgetRepository {
  readonly runs = new Map<string, AiRun>();
  readonly months = new Map<string, MonthRow>();

  private month(key: string): MonthRow {
    let row = this.months.get(key);
    if (!row) {
      row = { spent: 0, reserved: 0, blockedUntil: null, blockReason: null };
      this.months.set(key, row);
    }
    return row;
  }

  save(run: AiRun): Promise<void> {
    this.runs.set(run.id, run);
    return Promise.resolve();
  }

  findSucceededByCacheKey(cacheKey: string): Promise<AiRun | null> {
    const found = [...this.runs.values()].find(
      (run) => run.props.cacheKey === cacheKey && run.status === 'SUCCEEDED',
    );
    return Promise.resolve(found ?? null);
  }

  findById(id: string): Promise<AiRun | null> {
    return Promise.resolve(this.runs.get(id) ?? null);
  }

  listRecent(limit: number): Promise<AiRun[]> {
    return Promise.resolve(
      [...this.runs.values()]
        .sort((a, b) => b.props.createdAt.getTime() - a.props.createdAt.getTime())
        .slice(0, limit),
    );
  }

  reserve(request: ReserveRequest): Promise<ReserveOutcome> {
    const row = this.month(request.month);
    if (row.blockedUntil !== null && row.blockedUntil > request.now) {
      return Promise.resolve({ kind: 'providerBlocked', until: row.blockedUntil });
    }
    if (row.spent + row.reserved + request.run.props.reservedMicroUsd > request.capMicroUsd) {
      return Promise.resolve({ kind: 'exhausted' });
    }
    row.reserved += request.run.props.reservedMicroUsd;
    this.runs.set(request.run.id, request.run);
    return Promise.resolve({ kind: 'granted' });
  }

  settle(request: SettleRequest): Promise<boolean> {
    const current = this.runs.get(request.run.id);
    if (!current || current.status !== 'RESERVED') return Promise.resolve(false);
    const row = this.month(request.month);
    row.reserved -= request.releasedMicroUsd;
    row.spent += request.chargedMicroUsd;
    this.runs.set(request.run.id, request.run);
    return Promise.resolve(true);
  }

  abandonExpired(now: Date): Promise<number> {
    let count = 0;
    for (const run of [...this.runs.values()]) {
      const expires = run.props.reservationExpiresAt;
      if (
        run.status === 'RESERVED' &&
        expires !== null &&
        expires <= now
      ) {
        const closed = run.finish({
          status: 'ABANDONED',
          costMicroUsd: run.props.reservedMicroUsd,
          failureKind: 'Abandoned',
          failureMessage: 'la reserva venció sin conciliar',
          durationMs: 0,
          finishedAt: now,
        });
        if (!closed.ok) continue;
        const row = this.month(run.props.budgetMonth);
        row.reserved -= run.props.reservedMicroUsd;
        row.spent += run.props.reservedMicroUsd;
        this.runs.set(run.id, closed.value);
        count += 1;
      }
    }
    return Promise.resolve(count);
  }

  blockProvider(month: string, until: Date, reason: string): Promise<void> {
    const row = this.month(month);
    row.blockedUntil = until;
    row.blockReason = reason;
    return Promise.resolve();
  }

  getMonth(month: string): Promise<BudgetMonthSnapshot | null> {
    const row = this.months.get(month);
    if (!row) return Promise.resolve(null);
    return Promise.resolve({
      month,
      spentMicroUsd: row.spent,
      reservedMicroUsd: row.reserved,
      providerBlockedUntil: row.blockedUntil,
      providerBlockReason: row.blockReason,
    });
  }

  /** Estado del mes para los asserts. */
  snapshot(month: string): { spent: number; reserved: number } {
    const row = this.month(month);
    return { spent: row.spent, reserved: row.reserved };
  }
}

type CompleteStep<T = unknown> = Result<LlmCompletion<T>, LlmFailure>;

/** `LlmPort` guionado: cuenta las llamadas y devuelve lo que se le indique, en orden. */
export class ScriptedLlm implements LlmPort {
  countCalls = 0;
  completeCalls = 0;
  readonly requests: LlmRequest[] = [];
  countResult: Result<number, ProviderLlmFailure> = ok(100);
  private readonly steps: CompleteStep[] = [];
  /** Se usa cuando la cola de pasos se vació. */
  defaultStep: CompleteStep = ok(completion({ estado: 'ok' }));

  queue(step: CompleteStep): this {
    this.steps.push(step);
    return this;
  }

  countInputTokens(request: LlmRequest): Promise<Result<number, ProviderLlmFailure>> {
    this.countCalls += 1;
    this.requests.push(request);
    return Promise.resolve(this.countResult);
  }

  complete<T>(request: LlmRequest<T>): Promise<Result<LlmCompletion<T>, LlmFailure>> {
    this.completeCalls += 1;
    this.requests.push(request as LlmRequest);
    const step = this.steps.shift() ?? this.defaultStep;
    return Promise.resolve(step as CompleteStep<T>);
  }
}

export function completion<T>(
  output: T,
  usage: Partial<LlmCompletion<T>['usage']> = {},
): LlmCompletion<T> {
  return {
    output,
    usage: {
      inputTokens: 200,
      outputTokens: 50,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      ...usage,
    },
    stopReason: 'end_turn',
    requestId: 'req_test',
    model: 'claude-haiku-5-5',
  };
}

export const failWith = (error: LlmFailure): CompleteStep => fail(error);
