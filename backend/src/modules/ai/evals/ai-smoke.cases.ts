import { aiSmokeTask, AiSmokeOutput, AiSmokeSource } from '../application/tasks/ai-smoke.task';
import { defineEvalSuite } from './eval-harness';

/**
 * Evals de la tarea de humo (D16). Entrada fija, sin datos de nadie. Tres casos con su cassette:
 * respuesta válida, `refusal` y `max_tokens`. Umbral: el schema válido en el 100 % de los casos.
 */
export const aiSmokeEvalSuite = defineEvalSuite<AiSmokeSource, AiSmokeOutput>({
  task: aiSmokeTask,
  threshold: 1,
  cases: [
    {
      id: 'valido',
      source: { caso: 'valido' },
      expect: 'output',
      validate: (output) => (output.estado === 'ok' ? [] : ['estado inesperado']),
    },
    { id: 'refusal', source: { caso: 'refusal' }, expect: 'Refused' },
    { id: 'max-tokens', source: { caso: 'max-tokens' }, expect: 'Truncated' },
  ],
});
