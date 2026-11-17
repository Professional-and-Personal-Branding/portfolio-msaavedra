import { buildCacheKey, canonicalJson, hashInput } from '../../domain/ai-cache-key';
import { assertLlmSafe, LlmPayload } from '../../domain/data-boundary/data-boundary';
import { ForbiddenDataError } from '../../domain/errors/ai.errors';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { LlmRequest } from '../ports/llm.port';
import { AiTaskDefinition } from '../tasks/ai-task';

/** En el JSON de la entrada, `<` y `>` van como escapes válidos de JSON: ningún valor puede cerrar `</datos>` (M2). */
function escapeJsonAngles(json: string): string {
  return json.replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

/** En el texto libre se escapan en vez de quitarse: una sola pasada de quitar deja pasar `<</texto>/texto>` (M2). */
function escapeFreeText(text: string): string {
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Mensaje del usuario con la entrada delimitada como dato (D5): nunca son instrucciones. */
export function buildUserMessage(payload: LlmPayload): string {
  const parts = [`<datos>\n${escapeJsonAngles(canonicalJson(payload.structured))}\n</datos>`];
  for (const name of Object.keys(payload.freeText).sort()) {
    const safeName = name.replace(/[^A-Za-z0-9_.-]/g, '_');
    parts.push(`<texto nombre="${safeName}">\n${escapeFreeText(payload.freeText[name])}\n</texto>`);
  }
  return parts.join('\n');
}

export interface PreparedRun<O> {
  readonly payload: LlmPayload;
  readonly inputHash: string;
  readonly cacheKey: string;
  readonly request: LlmRequest<O>;
}

/**
 * Del origen de la tarea a la petición lista: lista blanca → guardián de datos → hash de la entrada
 * saneada → clave de caché → petición. Lo usan el runner y las evals (las dos deben coincidir en la
 * clave: es lo que busca un cassette).
 */
export function prepareTaskRun<I, O>(
  task: AiTaskDefinition<I, O>,
  source: I,
  knownSecrets: readonly string[],
): Result<PreparedRun<O>, ForbiddenDataError> {
  const safe = assertLlmSafe(task.buildInput(source), knownSecrets);
  if (!safe.ok) return fail(safe.error);
  const payload = safe.value.payload;
  const input = { structured: payload.structured, freeText: payload.freeText };
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
  return ok({
    payload,
    inputHash: hashInput(input),
    cacheKey,
    request: {
      task: task.id,
      cacheKey,
      model: task.model,
      effort: task.effort,
      thinking: task.thinking,
      maxTokens: task.maxTokens,
      system: task.systemPrompt,
      cacheSystemPrompt: task.cacheSystemPrompt,
      user: buildUserMessage(payload),
      schema: task.outputSchema,
    },
  });
}
