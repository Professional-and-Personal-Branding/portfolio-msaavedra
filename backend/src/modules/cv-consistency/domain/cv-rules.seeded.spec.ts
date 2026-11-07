import { CV_ISSUE_CODES, CV_ISSUE_SEVERITY, CvIssueCode } from './cv-issue';
import { AS_OF, cleanSnapshot, SEEDED_MUTATIONS } from './cv-rules.seeded.fixture';
import { runCvRules } from './run-cv-rules';

const ctx = { asOf: AS_OF };

describe('errores sembrados (D14)', () => {
  it('el catálogo tiene 14 códigos y cada uno una severidad', () => {
    expect(CV_ISSUE_CODES).toHaveLength(14);
    for (const code of CV_ISSUE_CODES) expect(CV_ISSUE_SEVERITY[code]).toBeDefined();
  });

  it('la instantánea limpia no produce hallazgos', () => {
    expect(runCvRules(cleanSnapshot(), ctx)).toEqual([]);
  });

  it('cada código del catálogo tiene su mutación (el 100 % es verificable)', () => {
    expect(Object.keys(SEEDED_MUTATIONS).sort()).toEqual([...CV_ISSUE_CODES].sort());
  });

  it.each(CV_ISSUE_CODES.map((code) => [code]))(
    '%s: la mutación produce ese código sobre el ítem y el campo esperados',
    (code: CvIssueCode) => {
      const seeded = SEEDED_MUTATIONS[code];
      const issues = runCvRules(seeded.mutate(cleanSnapshot()), ctx);

      const hit = issues.find((i) => i.code === code && i.entityId === seeded.entityId);
      expect(hit).toBeDefined();
      expect(hit).toMatchObject({
        severity: CV_ISSUE_SEVERITY[code],
        entityType: seeded.entityType,
        entityId: seeded.entityId,
        field: seeded.field,
      });
      // Un defecto sembrado no arrastra otros errores.
      const otherErrors = issues.filter((i) => i.severity === 'error' && i.code !== code);
      expect(otherErrors).toEqual([]);
    },
  );

  it('la mutación no cambia la instantánea limpia (las reglas no mutan)', () => {
    const clean = cleanSnapshot();
    const before = JSON.stringify(clean);
    for (const seeded of Object.values(SEEDED_MUTATIONS)) runCvRules(seeded.mutate(clean), ctx);
    expect(JSON.stringify(clean)).toBe(before);
  });
});
