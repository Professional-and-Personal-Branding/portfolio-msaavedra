import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { fail, ok, Result } from '../../../../shared/domain/result';
import {
  LlmCompletion,
  LlmFailure,
  LlmPort,
  LlmRequest,
  ProviderLlmFailure,
} from '../../application/ports/llm.port';
import { interpretMessage, RawMessage } from '../shared/interpret-message';

/** Una respuesta grabada (D16): sin cabeceras, sin `request_id` y sin la clave. */
export interface Cassette {
  readonly task: string;
  readonly promptVersion: number;
  readonly promptSha256: string;
  readonly model: string;
  readonly cacheKey: string;
  readonly recordedAt: string;
  readonly sdkVersion: string;
  readonly pricingVerifiedAt: string;
  readonly response: RawMessage;
}

/** Lee todos los `*.json` de un directorio de cassettes (recursivo). */
export function loadCassettes(dir: string): Cassette[] {
  const found: Cassette[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...loadCassettes(full));
    else if (entry.endsWith('.json'))
      found.push(JSON.parse(readFileSync(full, 'utf-8')) as Cassette);
  }
  return found;
}

/**
 * Reproduce respuestas grabadas buscando por `cacheKey` (D16). Nunca va a la red: si falta el
 * cassette, la corrida falla (y el test de evals, que comprueba los cassettes antes, también).
 */
export class CassetteLlmAdapter implements LlmPort {
  private readonly byKey = new Map<string, Cassette>();

  constructor(cassettes: readonly Cassette[]) {
    for (const cassette of cassettes) this.byKey.set(cassette.cacheKey, cassette);
  }

  has(cacheKey: string): boolean {
    return this.byKey.has(cacheKey);
  }

  countInputTokens(request: LlmRequest): Promise<Result<number, ProviderLlmFailure>> {
    const cassette = this.byKey.get(request.cacheKey);
    if (!cassette) return Promise.resolve(fail(this.missing(request)));
    return Promise.resolve(ok(cassette.response.usage.input_tokens));
  }

  complete<T>(request: LlmRequest<T>): Promise<Result<LlmCompletion<T>, LlmFailure>> {
    const cassette = this.byKey.get(request.cacheKey);
    if (!cassette) return Promise.resolve(fail(this.missing(request)));
    return Promise.resolve(interpretMessage(cassette.response, request.schema, null));
  }

  private missing(request: LlmRequest): ProviderLlmFailure {
    return {
      kind: 'Permanent',
      message: `falta el cassette de la tarea ${request.task} (${request.cacheKey.slice(0, 12)}…): regrabalo con npm run ai:eval -- --record`,
    };
  }
}
