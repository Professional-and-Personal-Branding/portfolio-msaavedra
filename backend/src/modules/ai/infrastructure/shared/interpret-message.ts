import type { ZodType } from 'zod';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { LlmCompletion, LlmFailure } from '../../application/ports/llm.port';
import { LlmUsage } from '../../domain/estimate-cost';

/**
 * Forma estructural de la respuesta de la API de mensajes que interesa acá. No importa tipos del
 * SDK: la usan el adaptador real y el de cassettes, que graban la misma forma.
 */
export interface RawMessage {
  readonly content: ReadonlyArray<{ readonly type: string; readonly text?: string }>;
  readonly stop_reason: string | null;
  readonly stop_details?: { readonly category: string | null } | null;
  readonly usage: {
    readonly input_tokens: number;
    readonly output_tokens: number;
    readonly cache_read_input_tokens?: number | null;
    readonly cache_creation_input_tokens?: number | null;
  };
  readonly model: string;
}

export function usageOf(message: RawMessage): LlmUsage {
  return {
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
  };
}

/**
 * Lee una respuesta en el orden de D5: `refusal` → `max_tokens` → salida inválida → salida.
 * En todos los casos el `usage` viaja con el resultado para conciliar el costo.
 */
export function interpretMessage<T>(
  message: RawMessage,
  schema: ZodType<T>,
  requestId: string | null,
): Result<LlmCompletion<T>, LlmFailure> {
  const usage = usageOf(message);
  if (message.stop_reason === 'refusal') {
    return fail({
      kind: 'Refused',
      category: message.stop_details?.category ?? null,
      usage,
      requestId,
    });
  }
  if (message.stop_reason === 'max_tokens') return fail({ kind: 'Truncated', usage, requestId });

  const text = message.content.find((block) => block.type === 'text');
  if (text === undefined || typeof text.text !== 'string') {
    return fail({
      kind: 'InvalidOutput',
      issues: ['la respuesta no trae texto'],
      usage,
      requestId,
    });
  }
  let json: unknown;
  try {
    json = JSON.parse(text.text);
  } catch {
    return fail({ kind: 'InvalidOutput', issues: ['la respuesta no es JSON'], usage, requestId });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join('.') || '(raíz)'}: ${issue.message}`);
    return fail({ kind: 'InvalidOutput', issues, usage, requestId });
  }
  return ok({
    output: parsed.data,
    usage,
    stopReason: message.stop_reason ?? 'unknown',
    requestId,
    model: message.model,
  });
}
