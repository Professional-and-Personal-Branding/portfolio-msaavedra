import { aiSmokeEvalSuite } from './ai-smoke.cases';
import { EvalSuite } from './eval-harness';

/** Todas las suites de evals, una por tarea de IA registrada. */
export const AI_EVAL_SUITES: readonly EvalSuite[] = [aiSmokeEvalSuite];
