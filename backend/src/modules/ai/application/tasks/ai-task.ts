import { readFileSync } from 'fs';
import { join } from 'path';
import type { ZodType } from 'zod';
import { sha256Hex } from '../../domain/ai-cache-key';
import { LlmPayload } from '../../domain/data-boundary/data-boundary';
import { AiModelId } from '../../domain/model-pricing';
import { AiEffort, AiThinking } from '../ports/llm.port';

/**
 * Definición de una tarea de IA, versionada en el repositorio (D4). El modelo no se cambia por
 * variable de entorno: es parte de la clave de caché y de lo que la eval aprobó.
 */
export interface AiTaskDefinition<I, O> {
  readonly id: string;
  readonly promptVersion: number;
  /** SHA-256 del texto del prompt (con saltos de línea LF): editarlo obliga a subir la versión. */
  readonly promptSha256: string;
  readonly systemPrompt: string;
  readonly model: AiModelId;
  readonly effort: AiEffort;
  readonly thinking: AiThinking;
  readonly maxTokens: number;
  readonly cacheSystemPrompt: boolean;
  /** Se sube si cambia la forma de la salida: entra en la clave de caché. */
  readonly schemaVersion: number;
  readonly outputSchema: ZodType<O>;
  /** Salida válida de ejemplo: la devuelve el proveedor `fake` (D20). */
  readonly fakeExample: O;
  /**
   * Origen de ejemplo armado con los datos FICTICIOS de `docs/examples/cv-data.example.json`: lo
   * usa el test de lista negra (D13, capa 3) para comprobar que `buildInput` no deja salir el email.
   */
  sampleSource(exampleCv: Readonly<Record<string, unknown>>): I;
  /** Arma el payload con lista blanca, campo por campo (D13, capa 1). Nunca hace spread de una entidad. */
  buildInput(source: I): LlmPayload;
}

/** Tarea sin tipar sus parámetros, para registros y listas. */
export type AnyAiTask = AiTaskDefinition<never, unknown>;

export function normalizePromptText(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

export function promptSha256(text: string): string {
  return sha256Hex(normalizePromptText(text));
}

/** Directorio de los prompts: junto al código (en `dist` los copia el `assets` de `nest-cli.json`). */
export const PROMPTS_DIR = join(__dirname, '..', '..', 'prompts');

export function promptPath(task: string, version: number): string {
  return join(PROMPTS_DIR, task, `v${version}.md`);
}

export function readPrompt(task: string, version: number): string {
  return normalizePromptText(readFileSync(promptPath(task, version), 'utf-8'));
}

/**
 * Lee el prompt y verifica su hash contra el registrado: si alguien lo editó sin subir la versión,
 * el módulo no carga (y el test de prompts falla nombrando la tarea).
 */
export function loadPrompt(task: string, version: number, expectedSha256: string): string {
  const text = readPrompt(task, version);
  const actual = promptSha256(text);
  if (actual !== expectedSha256) {
    throw new Error(
      `El prompt de la tarea "${task}" v${version} cambió (hash ${actual}) sin registrar una versión nueva`,
    );
  }
  return text;
}
