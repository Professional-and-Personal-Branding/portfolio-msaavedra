import { AS_OF, cleanSnapshot } from '../cv-rules.seeded.fixture';
import { CvSnapshot } from '../cv-snapshot';
import { currentRule } from './current.rule';

const ctx = { asOf: AS_OF };
const withCurrent = (flags: Record<string, { current: boolean; visible: boolean }>): CvSnapshot => {
  const s = cleanSnapshot();
  return {
    ...s,
    experiences: s.experiences.map((e) => ({ ...e, ...flags[e.id] })),
  };
};

describe('currentRule (experience.multiple-current)', () => {
  it('una sola actual no emite', () => {
    expect(currentRule(cleanSnapshot(), ctx)).toEqual([]);
  });

  it('dos actuales visibles: un issue por cada una, con count 2', () => {
    const found = currentRule(
      withCurrent({
        'exp-a': { current: true, visible: true },
        'exp-b': { current: true, visible: true },
      }),
      ctx,
    );
    expect(found.map((i) => [i.entityId, i.params, i.severity])).toEqual([
      ['exp-a', { count: 2 }, 'info'],
      ['exp-b', { count: 2 }, 'info'],
    ]);
  });

  it('una actual visible y otra oculta no emite', () => {
    expect(
      currentRule(
        withCurrent({
          'exp-a': { current: true, visible: false },
          'exp-b': { current: true, visible: true },
        }),
        ctx,
      ),
    ).toEqual([]);
  });
});
