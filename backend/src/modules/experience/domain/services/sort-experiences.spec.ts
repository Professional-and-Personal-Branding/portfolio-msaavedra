import { Experience } from '../entities/experience.entity';
import { sortExperiences } from './sort-experiences';

function exp(id: string, order: number, startDate: string): Experience {
  return Experience.create({
    id,
    company: id,
    role: { es: 'Rol' },
    startDate,
    endDate: null,
    current: false,
    location: '',
    summary: { es: '' },
    highlights: { es: [] },
    technologies: [],
    tags: [],
    sector: [],
    order,
    visible: true,
  });
}

describe('sortExperiences (orden canónico cronológico)', () => {
  it('ordena por startDate descendente aunque order diga otra cosa', () => {
    const sorted = sortExperiences([
      exp('vidoomy', 5, '2022-02'),
      exp('kiwox', 6, '2022-04'),
      exp('novacomp', 0, '2026-03'),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(['novacomp', 'kiwox', 'vidoomy']);
  });

  it('a igual startDate, desempata por order ascendente', () => {
    const sorted = sortExperiences([
      exp('k27', 3, '2023-01'),
      exp('eron', 2, '2023-01'),
      exp('ensitech', 1, '2023-07'),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(['ensitech', 'eron', 'k27']);
  });

  it('no muta el array original', () => {
    const input = [exp('b', 1, '2019-01'), exp('a', 0, '2018-01')];
    const copy = [...input];
    sortExperiences(input);
    expect(input).toEqual(copy);
  });

  it('lista vacía devuelve lista vacía', () => {
    expect(sortExperiences([])).toEqual([]);
  });
});
