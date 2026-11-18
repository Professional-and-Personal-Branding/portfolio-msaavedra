import { Cassette } from '../infrastructure/cassette/cassette-llm.adapter';
import { EvalSuite } from './eval-harness';

/**
 * Problemas entre las suites y sus cassettes (D16): un cassette faltante, uno grabado con otra
 * versión o texto del prompt, o uno que ya no corresponde a ningún caso de una tarea vigente.
 * Vacío = todo en orden. Un cassette viejo hace fallar el CI pidiendo regrabarlo.
 */
export function findCassetteProblems(
  suites: readonly EvalSuite[],
  cassettes: readonly Cassette[],
  knownSecrets: readonly string[] = [],
): string[] {
  const problems: string[] = [];
  const byKey = new Map(cassettes.map((c) => [c.cacheKey, c]));
  const used = new Set<string>();
  for (const suite of suites) {
    for (const item of suite.cases) {
      const label = `${suite.task.id}/${item.id}`;
      const prepared = item.prepare(knownSecrets);
      if (!prepared.ok) {
        problems.push(`${label}: la entrada del caso no pasa el guardián de datos`);
        continue;
      }
      const cassette = byKey.get(prepared.value.cacheKey);
      if (!cassette) {
        problems.push(`${label}: falta el cassette; regrabalo con npm run ai:eval -- --record`);
        continue;
      }
      used.add(cassette.cacheKey);
      if (
        cassette.promptSha256 !== suite.task.promptSha256 ||
        cassette.promptVersion !== suite.task.promptVersion
      ) {
        problems.push(`${label}: el cassette es de otro prompt (promptSha256); regrabalo`);
      }
    }
  }
  for (const cassette of cassettes) {
    if (!used.has(cassette.cacheKey)) {
      problems.push(
        `cassette de ${cassette.task} (${cassette.cacheKey.slice(0, 12)}…) no corresponde a ninguna tarea y versión vigentes`,
      );
    }
  }
  return problems;
}
