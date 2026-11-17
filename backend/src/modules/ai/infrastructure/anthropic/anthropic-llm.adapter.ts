import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { classifyAnthropicError } from '../../../../shared/domain/provider-failure/classify-anthropic-error';
import { ProviderFailure } from '../../../../shared/domain/provider-failure/provider-failure';
import { sanitizeFailure } from '../../../../shared/domain/provider-failure/sanitize-failure';
import { redactSecrets } from '../../../../shared/domain/redact-secrets';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { interpretMessage, RawMessage } from '../shared/interpret-message';
import {
  LlmCompletion,
  LlmFailure,
  LlmPort,
  LlmRequest,
  ProviderLlmFailure,
} from '../../application/ports/llm.port';

/** Reintentos del conteo de tokens: es gratis (D9). */
const COUNT_MAX_RETRIES = 2;
const COUNT_TIMEOUT_MS = 10_000;

export interface AnthropicAdapterOptions {
  readonly timeoutMs: number;
  /** Secretos a redactar de cualquier mensaje de error (la clave, como mínimo). */
  readonly knownSecrets: readonly string[];
  /**
   * Recibe cada respuesta tal como llegó (solo texto, estado y uso: sin cabeceras ni id de la
   * petición). La usa `npm run ai:eval -- --record` para grabar cassettes.
   */
  readonly onResponse?: (cacheKey: string, raw: RawMessage) => void;
}

/**
 * Único adaptador que habla con el SDK oficial (D5). Pide la salida con `output_config.format` y la
 * valida en el código con Zod: se usa `messages.create` y no `messages.parse` porque este último
 * lanza si el JSON no parsea, y un rechazo o un truncado (que sí se facturan) quedarían sin `usage`.
 * Orden de chequeo de la respuesta: `refusal` → `max_tokens` → salida inválida → salida.
 */
export class AnthropicLlmAdapter implements LlmPort {
  constructor(
    private readonly client: Anthropic,
    private readonly options: AnthropicAdapterOptions,
  ) {}

  async countInputTokens(
    request: LlmRequest,
    signal: AbortSignal,
  ): Promise<Result<number, ProviderLlmFailure>> {
    try {
      const counted = await this.client.messages.countTokens(
        {
          model: request.model,
          system: this.systemOf(request),
          messages: [{ role: 'user', content: request.user }],
          thinking: this.thinkingOf(request),
          output_config: { effort: request.effort, format: zodOutputFormat(request.schema) },
        },
        { signal, timeout: COUNT_TIMEOUT_MS, maxRetries: COUNT_MAX_RETRIES },
      );
      return ok(counted.input_tokens);
    } catch (error) {
      return fail(this.translate(error));
    }
  }

  async complete<T>(
    request: LlmRequest<T>,
    signal: AbortSignal,
  ): Promise<Result<LlmCompletion<T>, LlmFailure>> {
    let message: Anthropic.Message;
    let requestId: string | null = null;
    try {
      const response = await this.client.messages
        .create(
          {
            model: request.model,
            max_tokens: request.maxTokens,
            system: this.systemOf(request),
            messages: [{ role: 'user', content: request.user }],
            thinking: this.thinkingOf(request),
            output_config: { effort: request.effort, format: zodOutputFormat(request.schema) },
          },
          // Una sola vez: los reintentos del SDK multiplicarían el costo potencial (D9).
          { signal, timeout: this.options.timeoutMs, maxRetries: 0 },
        )
        .withResponse();
      message = response.data;
      requestId = response.request_id ?? null;
    } catch (error) {
      return fail(this.translate(error));
    }

    this.options.onResponse?.(request.cacheKey, toRaw(message));
    return interpretMessage(message, request.schema, requestId);
  }

  /** Con `cacheSystemPrompt` el system prompt va con `cache_control` efímero (5 min). */
  private systemOf(request: LlmRequest): string | Anthropic.TextBlockParam[] {
    if (!request.cacheSystemPrompt) return request.system;
    return [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }];
  }

  /**
   * Thinking apagado: Haiku 5.5 acepta `disabled` (con effort ≤ high) y Sonnet 5.5 da 400 con
   * `disabled`, así que se apaga con `between_tools` (D4).
   */
  private thinkingOf(request: LlmRequest): Anthropic.ThinkingConfigParam {
    if (request.thinking === 'adaptive') return { type: 'adaptive' };
    return request.model === 'claude-sonnet-5-5' ? { type: 'between_tools' } : { type: 'disabled' };
  }

  /** Traduce un error del SDK al clasificador compartido (D10). */
  private translate(error: unknown): ProviderLlmFailure {
    const redact = (text: string) => redactSecrets(text, this.options.knownSecrets);
    // Un timeout o un aborto después de enviar pueden haberse facturado: se imputa la reserva.
    if (error instanceof Anthropic.APIUserAbortError) {
      return { kind: 'Transient', message: 'consulta cancelada', billingUnknown: true };
    }
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      return { kind: 'Transient', message: 'timeout de la solicitud', billingUnknown: true };
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return { kind: 'Transient', message: redact('error de red con Anthropic') };
    }
    if (error instanceof Anthropic.APIError) {
      const status = error.status;
      const retryAfter = error.headers?.get('retry-after') ?? undefined;
      const classified = classifyAnthropicError({
        ...(status === undefined ? {} : { status }),
        body: error.error,
        ...(retryAfter === undefined ? {} : { retryAfter }),
      });
      if (status === 401 || status === 403) {
        return { kind: 'Permanent', message: 'Anthropic rechazó la clave' };
      }
      return this.cleaned(classified);
    }
    return { kind: 'Transient', message: redact('error inesperado al llamar a Anthropic') };
  }

  /** El spend limit conserva su fecha de reinicio; las demás pistas se acotan. */
  private cleaned(failure: ProviderFailure): ProviderLlmFailure {
    return failure.kind === 'BudgetExhausted' ? failure : sanitizeFailure(failure, new Date());
  }
}

/** Lo mínimo de la respuesta que interesa conservar: nada de cabeceras ni ids. */
function toRaw(message: Anthropic.Message): RawMessage {
  return {
    content: message.content.flatMap((block) =>
      block.type === 'text' ? [{ type: 'text', text: block.text }] : [],
    ),
    stop_reason: message.stop_reason,
    stop_details: message.stop_details ? { category: message.stop_details.category } : null,
    usage: {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
      cache_read_input_tokens: message.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: message.usage.cache_creation_input_tokens ?? 0,
    },
    model: message.model,
  };
}
