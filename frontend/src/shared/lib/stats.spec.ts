import { describe, expect, it } from 'vitest';
import { makeCuratedProfile, makeExperience } from '@/test/fixtures/curated-profile';
import { computeStats } from './stats';

describe('computeStats', () => {
  it('deriva años, experiencias, tecnologías únicas y certificaciones', () => {
    const data = makeCuratedProfile({
      experiences: [
        makeExperience({ id: 'a', technologies: ['TypeScript', 'NestJS'] }),
        makeExperience({ id: 'b', technologies: ['typescript ', 'Java'] }),
        makeExperience({ id: 'c', technologies: [] }),
      ],
    });

    expect(computeStats(data)).toEqual({
      years: 10,
      experiences: 3,
      technologies: 3,
      certifications: 2,
    });
  });

  it('sin perfil base los años son 0', () => {
    expect(computeStats(makeCuratedProfile({ profile: null })).years).toBe(0);
  });
});
