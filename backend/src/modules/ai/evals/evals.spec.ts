import { join } from 'path';
import { MutableClock } from '../../../../test/support/ai-doubles';
import { CassetteLlmAdapter, loadCassettes } from '../infrastructure/cassette/cassette-llm.adapter';
import { findCassetteProblems } from './cassette-check';
import { runEvalSuites } from './eval-harness';
import { AI_EVAL_SUITES } from './suites';

const CASSETTES_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'test',
  'fixtures',
  'ai',
  'cassettes',
);
const clock = new MutableClock(new Date('2026-11-17T12:00:00Z'));

/**
 * Evals de CI (D16): sin red, sin clave y sin base. Cada tarea tiene sus casos con datos ficticios
 * y sus cassettes; el adaptador de cassettes busca por `cacheKey` y nunca sale a la red.
 */
describe('evals con cassettes', () => {
  const cassettes = loadCassettes(CASSETTES_DIR);

  it('hay una suite por tarea registrada y cassettes que reproducir', () => {
    expect(AI_EVAL_SUITES.length).toBeGreaterThan(0);
    expect(cassettes.length).toBeGreaterThan(0);
  });

  it('no hay cassettes faltantes, viejos ni huérfanos', () => {
    expect(findCassetteProblems(AI_EVAL_SUITES, cassettes)).toEqual([]);
  });

  it.each(AI_EVAL_SUITES.map((suite) => [suite.task.id, suite] as const))(
    '%s alcanza su umbral con los cassettes',
    async (_id, suite) => {
      const [result] = await runEvalSuites([suite], {
        llm: new CassetteLlmAdapter(cassettes),
        capMicroUsd: 10_000_000,
        clock,
        knownSecrets: [],
      });
      expect(result.outcomes.filter((o) => !o.passed)).toEqual([]);
      expect(result.rate).toBeGreaterThanOrEqual(suite.threshold);
      expect(result.meetsThreshold).toBe(true);
    },
  );

  it('la tarea de humo cubre un cassette válido, un refusal y un max_tokens', () => {
    const stops = cassettes
      .filter((c) => c.task === 'ai.smoke')
      .map((c) => c.response.stop_reason)
      .sort();
    expect(stops).toEqual(['end_turn', 'max_tokens', 'refusal']);
  });

  it('un cassette de otra versión del prompt hace fallar la comprobación (autocontrol)', () => {
    const stale = cassettes.map((c, i) => (i === 0 ? { ...c, promptSha256: 'viejo' } : c));
    const problems = findCassetteProblems(AI_EVAL_SUITES, stale);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('regrabalo');
  });

  it('un cassette faltante hace fallar la comprobación y la suite (autocontrol)', async () => {
    const missing = cassettes.slice(1);
    expect(findCassetteProblems(AI_EVAL_SUITES, missing).join(' ')).toContain('falta el cassette');
    const [result] = await runEvalSuites([AI_EVAL_SUITES[0]], {
      llm: new CassetteLlmAdapter(missing),
      capMicroUsd: 10_000_000,
      clock,
      knownSecrets: [],
    });
    expect(result.meetsThreshold).toBe(false);
  });

  it('un cassette huérfano (otra tarea o versión) se detecta', () => {
    const orphan = { ...cassettes[0], cacheKey: 'deadbeef'.repeat(8) };
    expect(findCassetteProblems(AI_EVAL_SUITES, [...cassettes, orphan]).join(' ')).toContain(
      'no corresponde a ninguna tarea',
    );
  });
});
