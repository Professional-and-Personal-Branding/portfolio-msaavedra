import { classifyAnthropicError } from '../../../../shared/domain/provider-failure/classify-anthropic-error';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { AnyAiTask } from '../../application/tasks/ai-task';
import {
  LlmCompletion,
  LlmFailure,
  LlmPort,
  LlmRequest,
  ProviderLlmFailure,
} from '../../application/ports/llm.port';
import { AiFakeScenario } from '../../domain/fake-scenarios';
import { LlmUsage } from '../../domain/estimate-cost';

/** Uso fijo del proveedor de prueba: 200 de entrada y 50 de salida (≈ 45 micro-USD con Haiku). */
const FAKE_USAGE: LlmUsage = {
  inputTokens: 200,
  outputTokens: 50,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
};

export interface FakeLlmOptions {
  readonly scenario: AiFakeScenario;
  /** Para el escenario `slow`: espera este tiempo (el timeout configurado) antes de fallar. */
  readonly timeoutMs: number;
  readonly tasks: readonly AnyAiTask[];
}

function sleep(ms: number, signal: AbortSignal): Promise<'elapsed' | 'aborted'> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve('aborted');
    const timer = setTimeout(() => resolve('elapsed'), ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve('aborted');
      },
      { once: true },
    );
  });
}

/**
 * Proveedor determinista y sin red (D20): devuelve el ejemplo válido de la tarea o el escenario de
 * error pedido. Los errores se construyen con la misma forma que el SDK y pasan por el clasificador
 * real. El arranque lo prohíbe en producción.
 */
export class FakeLlmAdapter implements LlmPort {
  constructor(private readonly options: FakeLlmOptions) {}

  countInputTokens(request: LlmRequest): Promise<Result<number, ProviderLlmFailure>> {
    // Estimación estable: ~4 caracteres por token.
    return Promise.resolve(ok(Math.ceil((request.system.length + request.user.length) / 4)));
  }

  async complete<T>(
    request: LlmRequest<T>,
    signal: AbortSignal,
  ): Promise<Result<LlmCompletion<T>, LlmFailure>> {
    switch (this.options.scenario) {
      case 'ok':
        return this.success(request);
      case 'refusal':
        return fail({
          kind: 'Refused',
          category: 'general_harms',
          usage: FAKE_USAGE,
          requestId: null,
        });
      case 'truncated':
        return fail({
          kind: 'Truncated',
          usage: { ...FAKE_USAGE, outputTokens: request.maxTokens },
          requestId: null,
        });
      case 'invalid-output':
        return fail({
          kind: 'InvalidOutput',
          issues: ['salida de prueba inválida'],
          usage: FAKE_USAGE,
          requestId: null,
        });
      case 'transient':
        return fail(classifyAnthropicError({ status: 529 }));
      case 'spend-limit-tier':
        return fail(
          classifyAnthropicError({
            status: 429,
            body: {
              type: 'error',
              error: {
                type: 'rate_limit_error',
                message: 'You have reached your specified API usage limits.',
                details: { error_code: 'enforced_spend_limit_reached' },
              },
            },
          }),
        );
      case 'spend-limit-console':
        return fail(
          classifyAnthropicError({
            status: 400,
            body: {
              type: 'error',
              error: {
                type: 'invalid_request_error',
                message: 'You have reached your specified API usage limits.',
              },
            },
          }),
        );
      case 'slow': {
        const outcome = await sleep(this.options.timeoutMs, signal);
        return fail({
          kind: 'Transient',
          message: outcome === 'aborted' ? 'consulta cancelada' : 'timeout de la solicitud',
          billingUnknown: true,
        });
      }
    }
  }

  private success<T>(request: LlmRequest<T>): Result<LlmCompletion<T>, LlmFailure> {
    const task = this.options.tasks.find((candidate) => candidate.id === request.task);
    const parsed = request.schema.safeParse(task?.fakeExample);
    if (!parsed.success) {
      return fail({
        kind: 'InvalidOutput',
        issues: ['la tarea no declara una salida de ejemplo válida'],
        usage: FAKE_USAGE,
        requestId: null,
      });
    }
    return ok({
      output: parsed.data,
      usage: FAKE_USAGE,
      stopReason: 'end_turn',
      requestId: 'req_fake',
      model: request.model,
    });
  }
}
