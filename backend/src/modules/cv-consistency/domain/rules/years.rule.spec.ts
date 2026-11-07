import { AS_OF, cleanSnapshot } from '../cv-rules.seeded.fixture';
import { CvSnapshot } from '../cv-snapshot';
import { yearsRule } from './years.rule';

const ctx = { asOf: AS_OF };
const declaring = (years: number, base: CvSnapshot = cleanSnapshot()): CvSnapshot => ({
  ...base,
  profile: base.profile === null ? null : { ...base.profile, yearsOfExperience: years },
});

describe('yearsRule (profile.years-mismatch)', () => {
  it('con 141 meses acepta 11 y 12 (floor y ceil) y rechaza el resto', () => {
    expect(yearsRule(declaring(11), ctx)).toEqual([]);
    expect(yearsRule(declaring(12), ctx)).toEqual([]);
    expect(yearsRule(declaring(10), ctx)).toHaveLength(1);
    expect(yearsRule(declaring(13), ctx)).toHaveLength(1);
  });

  it('emite sobre el perfil con declared, months, years y remainderMonths', () => {
    expect(yearsRule(declaring(20), ctx)).toEqual([
      {
        code: 'profile.years-mismatch',
        severity: 'warning',
        entityType: 'profile',
        entityId: 'profile-1',
        field: 'yearsOfExperience',
        params: { declared: 20, months: 141, years: 11, remainderMonths: 9 },
      },
    ]);
  });

  it('cuenta las experiencias ocultas', () => {
    const base = cleanSnapshot();
    const hiddenOld = {
      ...base.experiences[0],
      id: 'exp-old',
      startDate: '2000-01',
      endDate: '2009-12',
      visible: false,
    };
    const snapshot = declaring(22, { ...base, experiences: [...base.experiences, hiddenOld] });
    // 141 + 120 = 261 meses = 21,75 años: 22 es consistente aunque la antigua esté oculta.
    expect(yearsRule(snapshot, ctx)).toEqual([]);
  });

  it('sin experiencias o sin perfil no emite', () => {
    expect(yearsRule({ ...declaring(50), experiences: [] }, ctx)).toEqual([]);
    expect(yearsRule({ ...cleanSnapshot(), profile: null }, ctx)).toEqual([]);
  });

  it('una experiencia actual avanza con asOf', () => {
    expect(yearsRule(declaring(12), { asOf: '2026-11' })).toEqual([]);
    expect(yearsRule(declaring(12), { asOf: '2031-01' })).toHaveLength(1);
  });
});
