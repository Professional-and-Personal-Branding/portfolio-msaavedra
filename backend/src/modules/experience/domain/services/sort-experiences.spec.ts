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

describe('sortExperiences', () => {
  it('ordena por order ascendente', () => {
    const sorted = sortExperiences([
      exp('c', 2, '2020-01'),
      exp('a', 0, '2018-01'),
      exp('b', 1, '2019-01'),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('a igual order, la startDate más reciente va primero', () => {
    const sorted = sortExperiences([
      exp('old', 0, '2019-03'),
      exp('new', 0, '2021-11'),
      exp('mid', 0, '2020-06'),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(['new', 'mid', 'old']);
  });

  it('no muta el array original', () => {
    const input = [exp('b', 1, '2019-01'), exp('a', 0, '2018-01')];
    const copy = [...input];
    sortExperiences(input);
    expect(input).toEqual(copy);
  });
});
