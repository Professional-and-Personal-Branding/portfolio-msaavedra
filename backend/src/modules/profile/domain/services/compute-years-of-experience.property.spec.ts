import * as fc from 'fast-check';
import { computeYearsOfExperience, ExperienceInterval } from './compute-years-of-experience';

/**
 * Propiedades de `computeYearsOfExperience` (D14 de `add-cv-consistency-rules`). La semilla se
 * puede fijar con `FC_SEED` para reproducir un fallo; ante un fallo, fast-check imprime la suya.
 */
const seed = process.env.FC_SEED !== undefined ? Number(process.env.FC_SEED) : 20261107;
const params: fc.Parameters<unknown> = { numRuns: 200, seed };

const AS_OF = '2030-12';
const BASE = 2000 * 12;
const LIMIT = 2030 * 12 + 11;

const toYm = (index: number): string =>
  `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
const idx = (value: string): number => Number(value.slice(0, 4)) * 12 + Number(value.slice(5)) - 1;
const lengthOf = (i: ExperienceInterval): number => idx(i.endDate as string) - idx(i.startDate) + 1;

/** Intervalo cerrado y válido dentro de [2000-01, 2030-12]. */
const closedInterval = fc
  .tuple(fc.integer({ min: 0, max: LIMIT - BASE }), fc.integer({ min: 0, max: 120 }))
  .map(([offset, length]): ExperienceInterval => {
    const start = BASE + offset;
    return {
      startDate: toYm(start),
      endDate: toYm(Math.min(start + length, LIMIT)),
      current: false,
    };
  });

describe('computeYearsOfExperience (propiedades)', () => {
  it('1. los meses están entre el intervalo más largo y el lapso total', () => {
    fc.assert(
      fc.property(fc.array(closedInterval, { minLength: 1, maxLength: 12 }), (intervals) => {
        const { months } = computeYearsOfExperience(intervals, AS_OF);
        const longest = Math.max(...intervals.map(lengthOf));
        const span =
          Math.max(...intervals.map((i) => idx(i.endDate as string))) -
          Math.min(...intervals.map((i) => idx(i.startDate))) +
          1;
        return months >= longest && months <= span;
      }),
      params,
    );
  });

  it('2. no cambia al permutar ni al duplicar intervalos', () => {
    fc.assert(
      fc.property(
        fc.array(closedInterval, { maxLength: 12 }),
        fc.array(fc.integer({ min: -1, max: 1 }), { minLength: 24, maxLength: 24 }),
        (intervals, noise) => {
          const base = computeYearsOfExperience(intervals, AS_OF);
          const doubled = [...intervals, ...intervals];
          const keyed = doubled.map((interval, position) => ({
            interval,
            key: position * 3 + noise[position % noise.length] * 2,
          }));
          const shuffled = keyed.sort((a, b) => a.key - b.key).map((entry) => entry.interval);
          return computeYearsOfExperience(shuffled, AS_OF).months === base.months;
        },
      ),
      params,
    );
  });

  it('3. con intervalos disjuntos y no contiguos, suma sus largos', () => {
    // Cada tramo empieza un mes después de que el anterior termina más un hueco de al menos 1.
    const disjoint = fc
      .array(fc.tuple(fc.integer({ min: 1, max: 25 }), fc.integer({ min: 1, max: 15 })), {
        maxLength: 8,
      })
      .map((parts) => {
        let cursor = BASE;
        return parts.map(([length, gap]): ExperienceInterval => {
          const start = cursor;
          cursor = start + length + gap;
          return { startDate: toYm(start), endDate: toYm(start + length - 1), current: false };
        });
      });
    fc.assert(
      fc.property(disjoint, (intervals) => {
        const expected = intervals.reduce((sum, i) => sum + lengthOf(i), 0);
        return computeYearsOfExperience(intervals, AS_OF).months === expected;
      }),
      params,
    );
  });

  it('4. un subconjunto nunca supera al total (monotonía)', () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(closedInterval, fc.boolean()), { maxLength: 14 }), (tagged) => {
        const all = tagged.map(([interval]) => interval);
        const subset = tagged.filter(([, picked]) => picked).map(([interval]) => interval);
        return (
          computeYearsOfExperience(subset, AS_OF).months <=
          computeYearsOfExperience(all, AS_OF).months
        );
      }),
      params,
    );
  });

  it('los años y los meses restantes recomponen los meses', () => {
    fc.assert(
      fc.property(fc.array(closedInterval, { maxLength: 12 }), (intervals) => {
        const r = computeYearsOfExperience(intervals, AS_OF);
        return r.years * 12 + r.remainderMonths === r.months && r.remainderMonths < 12;
      }),
      params,
    );
  });
});
