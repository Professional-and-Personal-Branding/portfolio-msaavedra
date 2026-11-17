import { join } from 'path';
import { Clock, systemClock } from '../../../shared/domain/clock';
import { LlmPort } from '../application/ports/llm.port';
import { MICRO_USD_PER_USD } from '../domain/model-pricing';
import { PRICING_VERIFIED_AT } from '../domain/model-pricing';
import { Cassette } from '../infrastructure/cassette/cassette-llm.adapter';
import { RawMessage } from '../infrastructure/shared/interpret-message';
import { prepareCassetteForWrite } from './cassette-writer';
import { estimateEvalReservations, EvalSuite, runEvalSuites } from './eval-harness';
import { AI_EVAL_SUITES } from './suites';

/** Tope por corrida cuando no se pide otro (D17, P1): los 10 USD de la app no se tocan. */
export const DEFAULT_EVAL_MAX_USD = 2;

/** Salida con código 2 = se negó sin gastar, igual que los `*_DISPOSABLE_DB=1` del repo. */
export const EXIT_REFUSED = 2;

export interface AiEvalCliDeps {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly log: (line: string) => void;
  readonly error: (line: string) => void;
  /** Construye el adaptador real con la clave; `onResponse` recibe cada respuesta cruda para `--record`. */
  readonly createLlm: (
    apiKey: string,
    onResponse: (cacheKey: string, raw: RawMessage) => void,
  ) => LlmPort;
  readonly writeFile: (path: string, content: string) => void;
  readonly cassettesDir: string;
  readonly sdkVersion: string;
  readonly suites?: readonly EvalSuite[];
  readonly clock?: Clock;
}

interface ParsedArgs {
  readonly task: string | null;
  readonly record: boolean;
  readonly maxUsd: number | null;
  readonly invalid: string | null;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  let task: string | null = null;
  let record = false;
  let maxUsd: number | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--record') record = true;
    else if (arg === '--task') task = argv[++i] ?? null;
    else if (arg === '--max-usd') {
      const value = Number(argv[++i]);
      if (!Number.isFinite(value) || value <= 0) {
        return { task, record, maxUsd, invalid: '--max-usd debe ser un número mayor que 0' };
      }
      maxUsd = value;
    } else return { task, record, maxUsd, invalid: `argumento desconocido: ${arg}` };
  }
  return { task, record, maxUsd, invalid: null };
}

const usd = (micro: number): string => (micro / MICRO_USD_PER_USD).toFixed(6);

/**
 * `npm run ai:eval` (D17). Corre los casos contra la API real con un presupuesto en memoria. Se
 * NIEGA (código 2) sin hacer ninguna llamada facturable si falta la clave, si falta
 * `AI_EVAL_ALLOW_SPEND=1` o si la suma de las reservas supera el tope de la corrida. Código 1 si
 * alguna tarea queda bajo su umbral. Solo datos ficticios: nunca el CV real del owner.
 */
export async function runAiEvalCli(argv: readonly string[], deps: AiEvalCliDeps): Promise<number> {
  const args = parseArgs(argv);
  if (args.invalid !== null) {
    deps.error(`ai:eval: ${args.invalid}`);
    return EXIT_REFUSED;
  }
  // La clave de las evals NO es la de la API de la app: va en un workspace aparte (P1).
  const apiKey = deps.env.AI_EVAL_API_KEY?.trim() ?? '';
  if (apiKey === '') {
    deps.error(
      'ai:eval: falta AI_EVAL_API_KEY (la clave del workspace de evals de la Console, distinta de ANTHROPIC_API_KEY). No se hizo ninguna llamada.',
    );
    return EXIT_REFUSED;
  }
  if (deps.env.AI_EVAL_ALLOW_SPEND !== '1') {
    deps.error(
      'ai:eval: las evals en vivo gastan dinero de verdad. Para permitirlo, exportá AI_EVAL_ALLOW_SPEND=1. No se hizo ninguna llamada.',
    );
    return EXIT_REFUSED;
  }
  const maxRaw = args.maxUsd ?? Number(deps.env.AI_EVAL_MAX_USD ?? DEFAULT_EVAL_MAX_USD);
  if (!Number.isFinite(maxRaw) || maxRaw <= 0) {
    deps.error('ai:eval: AI_EVAL_MAX_USD debe ser un número mayor que 0');
    return EXIT_REFUSED;
  }
  const capMicroUsd = Math.round(maxRaw * MICRO_USD_PER_USD);

  const all = deps.suites ?? AI_EVAL_SUITES;
  const suites = args.task === null ? all : all.filter((s) => s.task.id === args.task);
  if (suites.length === 0) {
    deps.error(`ai:eval: no hay una suite para la tarea "${args.task ?? ''}"`);
    return EXIT_REFUSED;
  }

  const raws = new Map<string, RawMessage>();
  const llm = deps.createLlm(apiKey, (cacheKey, raw) => raws.set(cacheKey, raw));
  const knownSecrets = [apiKey];

  // El conteo de tokens es gratis: con él se suman las reservas antes de gastar.
  const estimate = await estimateEvalReservations(suites, llm, knownSecrets);
  if (!estimate.ok) {
    deps.error(`ai:eval: ${estimate.error}. No se hizo ninguna llamada facturable.`);
    return EXIT_REFUSED;
  }
  if (estimate.value.totalMicroUsd > capMicroUsd) {
    deps.error(
      `ai:eval: la suma de las reservas (${usd(estimate.value.totalMicroUsd)} USD) supera el tope de la corrida (${usd(capMicroUsd)} USD). No se hizo ninguna llamada facturable; subí --max-usd o corré menos tareas.`,
    );
    return EXIT_REFUSED;
  }
  deps.log(
    `ai:eval: ${suites.length} suite(s), reservas ${usd(estimate.value.totalMicroUsd)} USD de un tope de ${usd(capMicroUsd)} USD`,
  );

  const clock = deps.clock ?? systemClock;
  const results = await runEvalSuites(suites, { llm, capMicroUsd, clock, knownSecrets });

  let belowThreshold = false;
  let totalCost = 0;
  for (const result of results) {
    totalCost += result.costMicroUsd;
    deps.log(
      `- ${result.taskId}: ${(result.rate * 100).toFixed(0)} % de los casos pasan (umbral ${(result.threshold * 100).toFixed(0)} %), ${result.inputTokens} tokens de entrada, ${result.outputTokens} de salida, costo real ${usd(result.costMicroUsd)} USD`,
    );
    for (const item of result.outcomes) {
      deps.log(
        `    ${item.passed ? 'ok ' : 'FALLA'} ${item.caseId} [${item.status}]${item.issues.length > 0 ? ` ${item.issues.join('; ')}` : ''}`,
      );
    }
    if (!result.meetsThreshold) belowThreshold = true;
  }
  deps.log(`ai:eval: costo real total ${usd(totalCost)} USD`);

  if (args.record) {
    const written = recordCassettes(suites, raws, apiKey, clock, deps);
    if (written === null) return EXIT_REFUSED;
    deps.log(`ai:eval: ${written} cassette(s) grabados en ${deps.cassettesDir}`);
  }
  return belowThreshold ? 1 : 0;
}

/** Graba los cassettes de lo que respondió la API; si alguno no pasa la redacción, no escribe NINGUNO. */
function recordCassettes(
  suites: readonly EvalSuite[],
  raws: ReadonlyMap<string, RawMessage>,
  apiKey: string,
  clock: Clock,
  deps: AiEvalCliDeps,
): number | null {
  const pending: Array<{ path: string; text: string }> = [];
  for (const suite of suites) {
    for (const item of suite.cases) {
      const prepared = item.prepare([apiKey]);
      if (!prepared.ok) continue;
      const raw = raws.get(prepared.value.cacheKey);
      if (!raw) continue;
      const cassette: Cassette = {
        task: suite.task.id,
        promptVersion: suite.task.promptVersion,
        promptSha256: suite.task.promptSha256,
        model: suite.task.model,
        cacheKey: prepared.value.cacheKey,
        recordedAt: clock.now().toISOString(),
        sdkVersion: deps.sdkVersion,
        pricingVerifiedAt: PRICING_VERIFIED_AT,
        response: raw,
      };
      const text = prepareCassetteForWrite(cassette, apiKey);
      if (!text.ok) {
        deps.error(`ai:eval: me niego a grabar ${suite.task.id}/${item.id}: ${text.error}`);
        return null;
      }
      pending.push({
        path: join(deps.cassettesDir, suite.task.id, `${item.id}.json`),
        text: text.value,
      });
    }
  }
  for (const file of pending) deps.writeFile(file.path, file.text);
  return pending.length;
}
