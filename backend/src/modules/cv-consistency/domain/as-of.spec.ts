import { CV_ISSUE_CODES, CV_ISSUE_SEVERITY } from './cv-issue';
import { cleanSnapshot, SEEDED_MUTATIONS } from './cv-rules.seeded.fixture';
import { CvSnapshot } from './cv-snapshot';
import { runCvRules } from './run-cv-rules';

/**
 * D11: ninguna regla `error` depende de `asOf`, así `cv:lint` no empieza a fallar en el CI un
 * día cualquiera. Se corre el fixture (limpio y con cada mutación) con dos meses distintos y
 * se comparan los errores.
 */
const errorsAt = (snapshot: CvSnapshot, asOf: string) =>
  runCvRules(snapshot, { asOf }).filter((i) => i.severity === 'error');

describe('independencia de los errores respecto de asOf', () => {
  it.each([
    ['2026-11', '2031-01'],
    ['2026-11', '2020-01'],
    ['2026-12', '2026-11'],
  ])('el CV limpio y cada mutación dan los mismos errores con %s y %s', (a, b) => {
    expect(errorsAt(cleanSnapshot(), a)).toEqual(errorsAt(cleanSnapshot(), b));
    for (const seeded of Object.values(SEEDED_MUTATIONS)) {
      const mutated = seeded.mutate(cleanSnapshot());
      expect(errorsAt(mutated, a)).toEqual(errorsAt(mutated, b));
    }
  });

  it('solo las reglas de severidad error son independientes: años y vencidas sí cambian', () => {
    const years = SEEDED_MUTATIONS['profile.years-mismatch'].mutate(cleanSnapshot());
    expect(runCvRules(years, { asOf: '2026-11' })).not.toEqual(
      runCvRules(years, { asOf: '2031-01' }),
    );
    const expired = cleanSnapshot();
    expect(runCvRules(expired, { asOf: '2031-01' }).map((i) => i.code)).toContain(
      'certification.expired',
    );
  });

  it('los códigos que dependen de asOf nunca son error', () => {
    const dependents = ['profile.years-mismatch', 'certification.expired'] as const;
    for (const code of dependents) expect(CV_ISSUE_SEVERITY[code]).not.toBe('error');
    expect(CV_ISSUE_CODES).toEqual(expect.arrayContaining([...dependents]));
  });
});
