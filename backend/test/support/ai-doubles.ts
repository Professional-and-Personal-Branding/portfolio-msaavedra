/**
 * Dobles de prueba de la base de IA (change `add-ai-foundation`): un almacén en memoria que
 * implementa los dos repositorios con la misma semántica que el SQL de Prisma, un `LlmPort`
 * guionado y utilidades de reloj, ids y logger. Ningún test llama a la API de Anthropic.
 */
import { Clock } from '../../src/shared/domain/clock';
import { fail, ok, Result } from '../../src/shared/domain/result';
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
export { InMemoryAiStore } from '../../src/modules/ai/infrastructure/memory/in-memory-ai-store';

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
    this.requests.push(request);
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
