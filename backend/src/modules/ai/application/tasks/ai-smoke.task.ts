import { z } from 'zod';
import { AiTaskDefinition, loadPrompt } from './ai-task';

export const AI_SMOKE_TASK_ID = 'ai.smoke';
const PROMPT_VERSION = 1;
/** SHA-256 de `prompts/ai.smoke/v1.md` (LF). Si cambia el texto, hay que crear `v2.md` y registrarlo. */
const PROMPT_SHA256 = 'a6a55e3df049d1451041888943b84f5c52d83d43cf5176cae19b0672698cb1ec';

export const aiSmokeOutputSchema = z.object({ estado: z.enum(['ok']) });
export type AiSmokeOutput = z.infer<typeof aiSmokeOutputSchema>;

/**
 * Tarea de humo (D18): texto fijo sin datos del usuario con Haiku 5.5. Sirve para probar la clave,
 * el presupuesto y el registro de punta a punta.
 */
export const aiSmokeTask: AiTaskDefinition<void, AiSmokeOutput> = {
  id: AI_SMOKE_TASK_ID,
  promptVersion: PROMPT_VERSION,
  promptSha256: PROMPT_SHA256,
  systemPrompt: loadPrompt(AI_SMOKE_TASK_ID, PROMPT_VERSION, PROMPT_SHA256),
  model: 'claude-haiku-5-5',
  effort: 'low',
  thinking: 'off',
  maxTokens: 256,
  cacheSystemPrompt: false,
  schemaVersion: 1,
  outputSchema: aiSmokeOutputSchema,
  fakeExample: { estado: 'ok' },
  buildInput: () => ({
    structured: { mensaje: 'Verificación de conexión: confirmá con estado ok.' },
    freeText: {},
  }),
};
