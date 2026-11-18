import { fail, ok, Result } from '../../../shared/domain/result';
import { ForbiddenDataError } from '../domain/errors/ai.errors';
import { AiRunFailedError } from '../domain/errors/ai-run-failed.error';
import { estimateReservation } from '../domain/estimate-cost';
import { LlmPort } from '../application/ports/llm.port';
import { AiSettings } from '../application/ports/ai-support.ports';
import { AiTaskRunner } from '../application/services/ai-task-runner';
import { BudgetGuard } from '../application/services/budget-guard';
import { PreparedRun, prepareTaskRun } from '../application/services/prepare-task-run';
import { AiTaskDefinition, AnyAiTask } from '../application/tasks/ai-task';
import { Clock } from '../../../shared/domain/clock';
import { InMemoryAiStore } from '../infrastructure/memory/in-memory-ai-store';
import { randomUUID } from 'crypto';

/** Qué se espera de un caso: una salida que pase los validadores, o un fallo tipado conocido. */
export type EvalExpectation = 'output' | 'Refused' | 'Truncated';

export interface EvalCase<I, O> {
  readonly id: string;
  readonly source: I;
  readonly expect: EvalExpectation;
  /** Validadores semánticos sobre la salida estructurada: devuelve los problemas (vacío = pasa). */
  readonly validate?: (output: O) => string[];
}

export interface EvalSuiteDefinition<I, O> {
  readonly task: AiTaskDefinition<I, O>;
  readonly cases: ReadonlyArray<EvalCase<I, O>>;
  /** Tasa mínima de casos que pasan (1 = todos). */
  readonly threshold: number;
}

export interface EvalCaseOutcome {
  readonly caseId: string;
  readonly passed: boolean;
  readonly status: string;
  readonly issues: string[];
  readonly costMicroUsd: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface EvalCaseRef {
  readonly id: string;
  readonly expect: EvalExpectation;
  prepare(knownSecrets: readonly string[]): Result<PreparedRun<unknown>, ForbiddenDataError>;
  run(runner: AiTaskRunner, store: InMemoryAiStore): Promise<EvalCaseOutcome>;
}

/** Suite con los tipos de su tarea ya cerrados en funciones (para listar suites distintas juntas). */
export interface EvalSuite {
  readonly task: AnyAiTask;
  readonly threshold: number;
  readonly cases: readonly EvalCaseRef[];
}

export function defineEvalSuite<I, O>(definition: EvalSuiteDefinition<I, O>): EvalSuite {
  const { task } = definition;
  return {
    task: task as unknown as AnyAiTask,
    threshold: definition.threshold,
    cases: definition.cases.map((item): EvalCaseRef => ({
      id: item.id,
      expect: item.expect,
      prepare: (knownSecrets) => prepareTaskRun(task, item.source, knownSecrets),
      run: async (runner, store) => {
        const result = await runner.run(task, item.source, { bypassCache: true });
        if (result.ok) {
          const props = result.value.run.props;
          const issues =
            item.expect === 'output'
              ? (item.validate?.(result.value.output) ?? [])
              : [`se esperaba ${item.expect} y la corrida salió bien`];
          return outcome(item.id, issues, props.status, props);
        }
        const error = result.error;
        if (error instanceof AiRunFailedError) {
          const props = store.runs.get(error.runId)?.props ?? null;
          const matches =
            (item.expect === 'Refused' && error.status === 'REFUSED') ||
            (item.expect === 'Truncated' && error.failureKind === 'Truncated');
          const issues = matches
            ? []
            : [
                item.expect === 'output'
                  ? `la corrida falló (${error.failureKind}): ${error.message}`
                  : `se esperaba ${item.expect} y salió ${error.failureKind}`,
              ];
          return outcome(item.id, issues, error.status, props);
        }
        return outcome(item.id, [error.message], 'BLOCKED', null);
      },
    })),
  };
}

function outcome(
  caseId: string,
  issues: string[],
  status: string,
  props: {
    costMicroUsd: number | null;
    usage: { inputTokens: number; outputTokens: number } | null;
  } | null,
): EvalCaseOutcome {
  return {
    caseId,
    passed: issues.length === 0,
    status,
    issues,
    costMicroUsd: props?.costMicroUsd ?? 0,
    inputTokens: props?.usage?.inputTokens ?? 0,
    outputTokens: props?.usage?.outputTokens ?? 0,
  };
}

export interface EvalSuiteResult {
  readonly taskId: string;
  readonly threshold: number;
  readonly rate: number;
  readonly meetsThreshold: boolean;
  readonly outcomes: EvalCaseOutcome[];
  readonly costMicroUsd: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface EvalRunDeps {
  readonly llm: LlmPort;
  readonly capMicroUsd: number;
  readonly clock: Clock;
  readonly knownSecrets: readonly string[];
  readonly timeoutMs?: number;
}

/**
 * Corre las suites con un presupuesto EN MEMORIA y el tope dado: no toca la base ni el ledger de la
 * app. Corta en cuanto el gasto real llega al tope (el guard rechaza las reservas siguientes).
 */
export async function runEvalSuites(
  suites: readonly EvalSuite[],
  deps: EvalRunDeps,
): Promise<EvalSuiteResult[]> {
  const store = new InMemoryAiStore();
  const timeoutMs = deps.timeoutMs ?? 60_000;
  const settings: AiSettings = {
    enabled: true,
    provider: 'anthropic',
    monthlyBudgetUsd: deps.capMicroUsd / 1_000_000,
    requestTimeoutMs: timeoutMs,
    maxConcurrency: 1,
    maxInputTokens: 100_000,
    knownSecrets: deps.knownSecrets,
  };
  const guard = new BudgetGuard(
    store,
    { capMicroUsd: deps.capMicroUsd, requestTimeoutMs: timeoutMs },
    deps.clock,
  );
  const runner = new AiTaskRunner(
    deps.llm,
    store,
    guard,
    deps.clock,
    settings,
    randomUUID,
    { acquire: () => Promise.resolve(() => undefined) },
    { log: () => undefined },
  );
  const results: EvalSuiteResult[] = [];
  for (const suite of suites) {
    const outcomes: EvalCaseOutcome[] = [];
    for (const item of suite.cases) outcomes.push(await item.run(runner, store));
    const passed = outcomes.filter((o) => o.passed).length;
    const rate = outcomes.length === 0 ? 0 : passed / outcomes.length;
    results.push({
      taskId: suite.task.id,
      threshold: suite.threshold,
      rate,
      meetsThreshold: rate >= suite.threshold,
      outcomes,
      costMicroUsd: outcomes.reduce((sum, o) => sum + o.costMicroUsd, 0),
      inputTokens: outcomes.reduce((sum, o) => sum + o.inputTokens, 0),
      outputTokens: outcomes.reduce((sum, o) => sum + o.outputTokens, 0),
    });
  }
  return results;
}

export interface EvalReservationEstimate {
  readonly totalMicroUsd: number;
  readonly perCase: Array<{ taskId: string; caseId: string; microUsd: number }>;
}

/**
 * Suma de las reservas (D7) de todos los casos, con `count_tokens` (gratis). Se usa antes de gastar
 * nada: si supera el tope de la corrida, la CLI se niega.
 */
export async function estimateEvalReservations(
  suites: readonly EvalSuite[],
  llm: LlmPort,
  knownSecrets: readonly string[],
): Promise<Result<EvalReservationEstimate, string>> {
  const perCase: EvalReservationEstimate['perCase'] = [];
  const signal = new AbortController().signal;
  for (const suite of suites) {
    for (const item of suite.cases) {
      const prepared = item.prepare(knownSecrets);
      if (!prepared.ok) return fail(`${suite.task.id}/${item.id}: ${prepared.error.message}`);
      const counted = await llm.countInputTokens(prepared.value.request, signal);
      if (!counted.ok) {
        return fail(
          `${suite.task.id}/${item.id}: no se pudo contar los tokens (${counted.error.message})`,
        );
      }
      perCase.push({
        taskId: suite.task.id,
        caseId: item.id,
        microUsd: estimateReservation({
          model: suite.task.model,
          countedInputTokens: counted.value,
          maxTokens: suite.task.maxTokens,
          cacheSystemPrompt: suite.task.cacheSystemPrompt,
        }),
      });
    }
  }
  return ok({ totalMicroUsd: perCase.reduce((sum, c) => sum + c.microUsd, 0), perCase });
}

export type { PreparedRun };
