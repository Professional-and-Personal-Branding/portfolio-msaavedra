import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, Clock } from '../../../../shared/domain/clock';
import { redactSecrets } from '../../../../shared/domain/redact-secrets';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { buildCacheKey, canonicalJson, hashInput } from '../../domain/ai-cache-key';
import { AiRun, AiRunFinish, AiRunIdentity } from '../../domain/ai-run.entity';
import { assertLlmSafe, LlmPayload } from '../../domain/data-boundary/data-boundary';
import {
  AiBudgetExhaustedError,
  AiBusyError,
  AiDisabledError,
  AiInputTooLargeError,
  ForbiddenDataError,
} from '../../domain/errors/ai.errors';
import { AiRunFailedError } from '../../domain/errors/ai-run-failed.error';
import {
  computeCost,
  estimatedInputTokens,
  estimateReservation,
  LlmUsage,
} from '../../domain/estimate-cost';
import { AI_RUN_REPOSITORY, AiRunRepository } from '../ports/ai-repositories';
import {
  AI_CONCURRENCY_LIMITER,
  AI_NEW_ID,
  AI_RUN_LOGGER,
  AI_SETTINGS,
  AiNewId,
  AiRunLogger,
  AiSettings,
  ConcurrencyLimiter,
} from '../ports/ai-support.ports';
import { LLM_PORT, LlmFailure, LlmPort, LlmRequest } from '../ports/llm.port';
import { AiTaskDefinition } from '../tasks/ai-task';
import { BudgetGuard, budgetMonthOf } from './budget-guard';

export const BUDGET_GUARD = Symbol('BudgetGuard');

/** Espera máxima por un lugar en el semáforo: pasado esto, 503 sin encolar (D14). */
export const CONCURRENCY_WAIT_MS = 2000;

export interface AiRunOptions {
  /** «Regenerar»: no busca en la caché y vuelve a llamar. */
  readonly bypassCache?: boolean;
  /** Se aborta si el llamador cierra la petición. */
  readonly signal?: AbortSignal;
}

export interface AiTaskSuccess<O> {
  readonly output: O;
  readonly run: AiRun;
}

export type AiTaskError =
  | AiDisabledError
  | AiBudgetExhaustedError
  | AiInputTooLargeError
  | AiBusyError
  | ForbiddenDataError
  | AiRunFailedError;

/** Cierra la sección de datos: un texto libre no puede salirse de su delimitador. */
const DELIMITER_TAGS = /<\/?\s*(datos|texto)[^>]*>/gi;

/** Mensaje del usuario con la entrada delimitada como dato (D5): nunca son instrucciones. */
export function buildUserMessage(payload: LlmPayload): string {
  const parts = [`<datos>\n${canonicalJson(payload.structured)}\n</datos>`];
  for (const name of Object.keys(payload.freeText).sort()) {
    const text = payload.freeText[name].replace(DELIMITER_TAGS, '');
    parts.push(`<texto nombre="${name}">\n${text}\n</texto>`);
  }
  return parts.join('\n');
}

/**
 * Orquesta una corrida de IA (D1): guardián de datos → caché → semáforo → conteo → reserva →
 * llamada (una sola vez) → conciliación → `AiRun`. Solo escribe `AiRun` y `AiBudgetMonth`: devuelve
 * una propuesta y nunca aplica nada sobre otro agregado (D15).
 */
@Injectable()
export class AiTaskRunner {
  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    @Inject(AI_RUN_REPOSITORY) private readonly runs: AiRunRepository,
    @Inject(BUDGET_GUARD) private readonly guard: BudgetGuard,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(AI_SETTINGS) private readonly settings: AiSettings,
    @Inject(AI_NEW_ID) private readonly newId: AiNewId,
    @Inject(AI_CONCURRENCY_LIMITER) private readonly limiter: ConcurrencyLimiter,
    @Inject(AI_RUN_LOGGER) private readonly logger: AiRunLogger,
  ) {}

  async run<I, O>(
    task: AiTaskDefinition<I, O>,
    source: I,
    options: AiRunOptions = {},
  ): Promise<Result<AiTaskSuccess<O>, AiTaskError>> {
    if (!this.settings.enabled) return fail(new AiDisabledError());

    const startedAt = this.clock.now();
    const month = budgetMonthOf(startedAt);

    // 1. Guardián: antes de la caché, del conteo y de la reserva (D13).
    const safe = assertLlmSafe(task.buildInput(source), this.settings.knownSecrets);
    if (!safe.ok) {
      const hash = hashInput({ bloqueado: safe.error.reason });
      const identity = this.identity(task, hash, hash, month, startedAt);
      await this.record(AiRun.blocked(identity, 'ForbiddenData', safe.error.message));
      return fail(safe.error);
    }
    const payload = safe.value.payload;
    const input = { structured: payload.structured, freeText: payload.freeText };
    const inputHash = hashInput(input);
    const cacheKey = buildCacheKey({
      task: task.id,
      promptVersion: task.promptVersion,
      promptHash: task.promptSha256,
      model: task.model,
      effort: task.effort,
      thinking: task.thinking,
      maxTokens: task.maxTokens,
      schemaVersion: task.schemaVersion,
      input,
    });
    const identity = this.identity(task, inputHash, cacheKey, month, startedAt);

    // 2. Caché por hash: ni conteo ni llamada (D11).
    if (options.bypassCache !== true) {
      const hit = await this.runs.findSucceededByCacheKey(cacheKey);
      if (hit) {
        const parsed = task.outputSchema.safeParse(hit.props.output);
        if (parsed.success) {
          const cached = AiRun.cached(identity, parsed.data);
          await this.record(cached);
          return ok({ output: parsed.data, run: cached });
        }
      }
    }

    // 3. Semáforo por proceso: sin lugar, 503 y sin reservar presupuesto (D14).
    const release = await this.limiter.acquire(CONCURRENCY_WAIT_MS);
    if (release === null) return fail(new AiBusyError());
    try {
      return await this.callAndSettle(task, payload, identity, startedAt, options);
    } finally {
      release();
    }
  }

  private async callAndSettle<I, O>(
    task: AiTaskDefinition<I, O>,
    payload: LlmPayload,
    identity: AiRunIdentity,
    startedAt: Date,
    options: AiRunOptions,
  ): Promise<Result<AiTaskSuccess<O>, AiTaskError>> {
    const signal = options.signal ?? new AbortController().signal;
    const request: LlmRequest<O> = {
      task: task.id,
      model: task.model,
      effort: task.effort,
      thinking: task.thinking,
      maxTokens: task.maxTokens,
      system: task.systemPrompt,
      cacheSystemPrompt: task.cacheSystemPrompt,
      user: buildUserMessage(payload),
      schema: task.outputSchema,
    };

    // 4. Conteo (gratis): si falla, no se llama a `messages` (falla cerrado).
    const counted = await this.llm.countInputTokens(request, signal);
    if (!counted.ok) {
      const failure = counted.error;
      if (failure.kind === 'BudgetExhausted') {
        await this.guard.blockProvider(identity.budgetMonth, failure.resetAt, failure.message);
      }
      const run = AiRun.failedBeforeReserve(
        identity,
        failure.kind,
        this.safeMessage(failure.message),
        this.elapsed(startedAt),
      );
      await this.record(run);
      return fail(this.failedError(run));
    }
    const estimated = estimatedInputTokens(counted.value);
    if (estimated > this.settings.maxInputTokens) {
      const error = new AiInputTooLargeError(estimated, this.settings.maxInputTokens);
      await this.record(AiRun.blocked(identity, 'InputTooLarge', error.message));
      return fail(error);
    }

    // 5. Reserva atómica del peor caso (D7, D8).
    const reservation = estimateReservation({
      model: task.model,
      countedInputTokens: counted.value,
      maxTokens: task.maxTokens,
      cacheSystemPrompt: task.cacheSystemPrompt,
    });
    const reserved = await this.guard.reserve(identity, reservation);
    if (!reserved.ok) {
      await this.record(AiRun.blocked(identity, 'BudgetExhausted', reserved.error.message));
      return fail(reserved.error);
    }

    // 6. La llamada facturable: una sola vez, sin reintentos (D9).
    let completion: Awaited<ReturnType<LlmPort['complete']>>;
    try {
      completion = await this.llm.complete(request, signal);
    } catch {
      // Un adaptador que lanza no debería pasar; ante la duda se imputa la reserva entera.
      completion = {
        ok: false,
        error: {
          kind: 'Transient',
          message: 'error inesperado del adaptador',
          billingUnknown: true,
        },
      };
    }

    // 7. Conciliación con el uso real.
    if (completion.ok) {
      const validated = task.outputSchema.safeParse(completion.value.output);
      const cost = computeCost(task.model, completion.value.usage);
      if (validated.success) {
        const run = await this.guard.settle(reserved.value, {
          status: 'SUCCEEDED',
          costMicroUsd: cost,
          usage: completion.value.usage,
          stopReason: completion.value.stopReason,
          output: validated.data,
          requestId: completion.value.requestId,
          durationMs: this.elapsed(startedAt),
          finishedAt: this.clock.now(),
        });
        this.logger.log(this.logEntry(run));
        return ok({ output: validated.data, run });
      }
      const run = await this.guard.settle(
        reserved.value,
        this.failureFinish(
          startedAt,
          'FAILED',
          'InvalidOutput',
          'la salida no cumple el schema de la tarea',
          cost,
          completion.value.usage,
          completion.value.requestId,
          completion.value.stopReason,
        ),
      );
      this.logger.log(this.logEntry(run));
      return fail(this.failedError(run));
    }

    const run = await this.settleFailure(task, reserved.value, completion.error, startedAt);
    this.logger.log(this.logEntry(run));
    return fail(this.failedError(run));
  }

  private async settleFailure<I, O>(
    task: AiTaskDefinition<I, O>,
    reserved: AiRun,
    failure: LlmFailure,
    startedAt: Date,
  ): Promise<AiRun> {
    switch (failure.kind) {
      case 'Refused':
        return this.guard.settle(
          reserved,
          this.failureFinish(
            startedAt,
            'REFUSED',
            'Refused',
            failure.category === null
              ? 'el modelo rechazó la solicitud'
              : `el modelo rechazó la solicitud (${failure.category})`,
            computeCost(task.model, failure.usage),
            failure.usage,
            failure.requestId,
            'refusal',
          ),
        );
      case 'Truncated':
        return this.guard.settle(
          reserved,
          this.failureFinish(
            startedAt,
            'FAILED',
            'Truncated',
            'la respuesta se cortó por max_tokens',
            computeCost(task.model, failure.usage),
            failure.usage,
            failure.requestId,
            'max_tokens',
          ),
        );
      case 'InvalidOutput':
        return this.guard.settle(
          reserved,
          this.failureFinish(
            startedAt,
            'FAILED',
            'InvalidOutput',
            `salida inválida: ${failure.issues.join('; ')}`,
            computeCost(task.model, failure.usage),
            failure.usage,
            failure.requestId,
          ),
        );
      default: {
        if (failure.kind === 'BudgetExhausted') {
          await this.guard.blockProvider(
            reserved.props.budgetMonth,
            failure.resetAt,
            this.safeMessage(failure.message),
          );
        }
        // Un timeout o aborto después de enviar puede haberse facturado: se imputa la reserva entera.
        const charged = failure.billingUnknown === true ? reserved.props.reservedMicroUsd : 0;
        return this.guard.settle(
          reserved,
          this.failureFinish(startedAt, 'FAILED', failure.kind, failure.message, charged),
        );
      }
    }
  }

  private failureFinish(
    startedAt: Date,
    status: 'REFUSED' | 'FAILED',
    failureKind: string,
    message: string,
    costMicroUsd: number,
    usage?: LlmUsage,
    requestId?: string | null,
    stopReason?: string,
  ): AiRunFinish {
    return {
      status,
      costMicroUsd,
      ...(usage ? { usage } : {}),
      ...(stopReason ? { stopReason } : {}),
      failureKind,
      failureMessage: this.safeMessage(message),
      requestId: requestId ?? null,
      durationMs: this.elapsed(startedAt),
      finishedAt: this.clock.now(),
    };
  }

  /** Todo mensaje que se guarda o se loguea pasa por `redactSecrets` con los secretos conocidos (D21). */
  private safeMessage(message: string): string {
    return redactSecrets(message, this.settings.knownSecrets);
  }

  private failedError(run: AiRun): AiRunFailedError {
    return new AiRunFailedError(
      run.id,
      run.status,
      run.props.failureKind ?? 'Unknown',
      run.props.failureMessage ?? 'La corrida de IA falló',
    );
  }

  private elapsed(startedAt: Date): number {
    return Math.max(0, this.clock.now().getTime() - startedAt.getTime());
  }

  private identity<I, O>(
    task: AiTaskDefinition<I, O>,
    inputHash: string,
    cacheKey: string,
    month: string,
    now: Date,
  ): AiRunIdentity {
    return {
      id: this.newId(),
      task: task.id,
      promptVersion: task.promptVersion,
      model: task.model,
      inputHash,
      cacheKey,
      budgetMonth: month,
      now,
    };
  }

  private async record(run: AiRun): Promise<void> {
    await this.runs.save(run);
    this.logger.log(this.logEntry(run));
  }

  private logEntry(run: AiRun) {
    const p = run.props;
    return {
      aiRunId: p.id,
      task: p.task,
      promptVersion: p.promptVersion,
      model: p.model,
      status: p.status,
      inputTokens: p.usage?.inputTokens ?? null,
      outputTokens: p.usage?.outputTokens ?? null,
      costMicroUsd: p.costMicroUsd,
      durationMs: p.durationMs,
      requestId: p.requestId,
      failureKind: p.failureKind,
    };
  }
}
