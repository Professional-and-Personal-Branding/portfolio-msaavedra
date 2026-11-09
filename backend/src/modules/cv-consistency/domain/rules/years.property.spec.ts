import * as fc from 'fast-check';
import { computeYearsOfExperience } from '../../../profile/domain/services/compute-years-of-experience';
import { cleanSnapshot } from '../cv-rules.seeded.fixture';
import { CvExperienceSnapshot } from '../cv-snapshot';
import { yearsRule } from './years.rule';

/** Propiedad 5 de D14: la regla de años aparece si y solo si el declarado sale de [floor, ceil]. */
const seed = process.env.FC_SEED !== undefined ? Number(process.env.FC_SEED) : 20261107;
const BASE = 2000 * 12;
const AS_OF = '2030-12';
const toYm = (index: number): string =>
  `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;

const experience = fc
  .tuple(
    fc.integer({ min: 0, max: 30 * 12 + 11 }),
    fc.integer({ min: 0, max: 100 }),
    fc.boolean(),
    fc.boolean(),
  )
  .map(([offset, length, current, visible]) => ({ offset, length, current, visible }));

const build = (
  {
    offset,
    length,
    current,
    visible,
  }: { offset: number; length: number; current: boolean; visible: boolean },
  position: number,
): CvExperienceSnapshot => {
  const base = cleanSnapshot().experiences[0];
  const start = BASE + offset;
  return {
    ...base,
    id: `exp-${position}`,
    startDate: toYm(start),
    endDate: current ? null : toYm(Math.min(start + length, 2030 * 12 + 11)),
    current,
    visible,
  };
};

describe('yearsRule (propiedad)', () => {
  it('5. emite si y solo si el declarado está fuera de [floor, ceil], con los params del cálculo', () => {
    fc.assert(
      fc.property(
        fc.array(experience, { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 0, max: 45 }),
        (drafts, declared) => {
          const experiences = drafts.map(build);
          const base = cleanSnapshot();
          const snapshot = {
            ...base,
            experiences,
            profile: base.profile && { ...base.profile, yearsOfExperience: declared },
          };
          const { months, years, remainderMonths } = computeYearsOfExperience(experiences, AS_OF);
          const consistent =
            declared >= Math.floor(months / 12) && declared <= Math.ceil(months / 12);
          const found = yearsRule(snapshot, { asOf: AS_OF });
          if (consistent) return found.length === 0;
          return (
            found.length === 1 &&
            found[0].code === 'profile.years-mismatch' &&
            found[0].params.declared === declared &&
            found[0].params.months === months &&
            found[0].params.years === years &&
            found[0].params.remainderMonths === remainderMonths
          );
        },
      ),
      { numRuns: 200, seed },
    );
  });
});
