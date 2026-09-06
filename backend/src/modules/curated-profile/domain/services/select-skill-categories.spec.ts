import { SkillCategory } from '../../../skill/domain/entities/skill-category.entity';
import { Skill } from '../../../skill/domain/entities/skill.entity';
import { selectSkillCategories } from './select-skill-categories';

const skill = (id: string, name: string, tags: string[], order = 0) =>
  Skill.create({ id, name, tags, order });
const category = (id: string, name: string, skills: Skill[]) =>
  SkillCategory.create({ id, name: { es: name }, order: 0, skills });

describe('selectSkillCategories', () => {
  const categories = [
    category('c1', 'Lenguajes', [
      skill('java', 'Java', ['java']),
      skill('csharp', 'C#', ['dotnet']),
      skill('ts', 'TypeScript', ['nodejs']),
    ]),
    category('c2', 'Metodologías', [skill('scrum', 'Scrum', ['leadership'])]),
  ];

  it('filtra parcialmente conservando el orden de skills', () => {
    const result = selectSkillCategories(categories, {
      filterTags: ['java', 'nodejs'],
      includeIds: [],
      excludeIds: [],
    });
    expect(result).toHaveLength(1);
    expect(result[0].skills.map((s) => s.name)).toEqual(['Java', 'TypeScript']);
  });

  it('descarta categorías que quedan vacías', () => {
    const result = selectSkillCategories(categories, {
      filterTags: ['leadership'],
      includeIds: [],
      excludeIds: [],
    });
    expect(result.map((c) => c.id)).toEqual(['c2']);
  });

  it('overrides aplican sobre skills', () => {
    const result = selectSkillCategories(categories, {
      filterTags: ['leadership'],
      includeIds: ['csharp'],
      excludeIds: ['scrum'],
    });
    expect(result.map((c) => c.id)).toEqual(['c1']);
    expect(result[0].skills.map((s) => s.id)).toEqual(['csharp']);
  });

  it('filterTags vacío conserva todo y no muta las categorías originales', () => {
    const result = selectSkillCategories(categories, {
      filterTags: [],
      includeIds: [],
      excludeIds: [],
    });
    expect(result.map((c) => c.skills.length)).toEqual([3, 1]);
    expect(categories[0].skills).toHaveLength(3);
  });
});
