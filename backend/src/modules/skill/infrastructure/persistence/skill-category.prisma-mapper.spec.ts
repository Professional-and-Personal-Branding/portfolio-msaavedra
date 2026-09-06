import { SkillCategoryRecord, toSkillCategoryEntity } from './skill-category.prisma-mapper';

const record: SkillCategoryRecord = {
  id: 'c1',
  name: { es: 'Lenguajes', en: 'Languages' },
  order: 0,
  createdAt: new Date(),
  skills: [
    { id: 's1', name: 'Java', tags: ['java'], order: 0, categoryId: 'c1' },
    { id: 's2', name: 'C#', tags: ['dotnet'], order: 1, categoryId: 'c1' },
  ],
};

describe('toSkillCategoryEntity', () => {
  it('mapea categoría y skills con tags', () => {
    const cat = toSkillCategoryEntity(record);
    expect(cat.name).toEqual({ es: 'Lenguajes', en: 'Languages' });
    expect(cat.skills.map((s) => s.name)).toEqual(['Java', 'C#']);
    expect(cat.skills[1].tags).toEqual(['dotnet']);
  });

  it('nombre malformado → vacío sin romper', () => {
    const cat = toSkillCategoryEntity({ ...record, name: [1] as never });
    expect(cat.name).toEqual({});
  });
});
