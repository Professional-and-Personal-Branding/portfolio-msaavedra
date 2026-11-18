import { isAllowedModel } from '../../domain/model-pricing';
import { aiSmokeTask } from './ai-smoke.task';
import { AnyAiTask } from './ai-task';

/**
 * Todas las tareas registradas. Cada feature de IA agrega la suya acá y su test de lista negra y
 * sus cassettes salen de esta lista.
 */
export const AI_TASKS: readonly AnyAiTask[] = [aiSmokeTask as unknown as AnyAiTask];

const MAX_EFFORT_WITH_THINKING_OFF = new Set(['low', 'medium', 'high']);

/** Problemas de una definición de tarea (vacío si es válida): modelo permitido, thinking y effort. */
export function taskDefinitionIssues(task: AnyAiTask): string[] {
  const issues: string[] = [];
  if (!isAllowedModel(task.model)) {
    issues.push(`modelo fuera del registro: ${String(task.model)}`);
  }
  // Haiku acepta `disabled` y Sonnet `between_tools` solo con effort ≤ high (D4).
  if (task.thinking === 'off' && !MAX_EFFORT_WITH_THINKING_OFF.has(task.effort)) {
    issues.push('thinking apagado exige effort high o menor');
  }
  if (!Number.isInteger(task.maxTokens) || task.maxTokens < 1 || task.maxTokens > 64_000) {
    issues.push('maxTokens fuera de rango');
  }
  if (!/^[a-z0-9]+(\.[a-z0-9-]+)+$/.test(task.id)) {
    issues.push('el id de la tarea debe ser del estilo "dominio.nombre"');
  }
  return issues;
}
