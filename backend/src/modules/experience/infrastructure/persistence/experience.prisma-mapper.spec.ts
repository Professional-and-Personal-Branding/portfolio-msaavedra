import { ExperienceRecord, toExperienceEntity } from './experience.prisma-mapper';

const record: ExperienceRecord = {
  id: 'e1',
  company: 'Novacomp',
  role: { es: 'Rol', en: 'Role' },
  startDate: '2026-03',
  endDate: '2026-08',
  current: false,
  location: 'Remoto',
  summary: { es: 'Resumen', en: 'Summary' },
  highlights: { es: ['a'], en: ['b'] },
  technologies: ['.NET'],
  tags: ['dotnet'],
  sector: ['fintech'],
  order: 0,
  visible: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('toExperienceEntity', () => {
  it('mapea el registro completo', () => {
    const e = toExperienceEntity(record);
    expect(e.company).toBe('Novacomp');
    expect(e.role).toEqual({ es: 'Rol', en: 'Role' });
    expect(e.highlights).toEqual({ es: ['a'], en: ['b'] });
    expect(e.tags).toEqual(['dotnet']);
    expect(e.matchesAnyTag(['java', 'dotnet'])).toBe(true);
    expect(e.matchesAnyTag(['java'])).toBe(false);
  });

  it('acepta listas planas legadas y JSON malformado sin romper', () => {
    const e = toExperienceEntity({
      ...record,
      highlights: ['plano'] as never,
      role: { es: 1 },
    });
    expect(e.highlights).toEqual(['plano']);
    expect(e.role).toEqual({});
  });
});
