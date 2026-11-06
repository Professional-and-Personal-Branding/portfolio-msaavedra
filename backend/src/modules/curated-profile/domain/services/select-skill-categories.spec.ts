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

  // Change add-builder-skill-project-overrides (D11): el constructor depende de estos escenarios.
  describe('overrides individuales de skills', () => {
    const criteria = (filterTags: string[], includeIds: string[], excludeIds: string[]) => ({
      filterTags,
      includeIds,
      excludeIds,
    });

    it('includeIds de una skill de una categoría sin coincidencias la hace aparecer con esa sola skill', () => {
      const result = selectSkillCategories(categories, criteria(['leadership'], ['ts'], []));
      expect(result.map((c) => c.id)).toEqual(['c1', 'c2']);
      expect(result[0].skills.map((s) => s.id)).toEqual(['ts']);
    });

    it('excludeIds de una skill que matchea la saca y la categoría conserva las demás', () => {
      const result = selectSkillCategories(categories, criteria(['java', 'nodejs'], [], ['java']));
      expect(result.map((c) => c.id)).toEqual(['c1']);
      expect(result[0].skills.map((s) => s.id)).toEqual(['ts']);
    });

    it('excludeIds de la única skill seleccionada hace desaparecer la categoría', () => {
      const result = selectSkillCategories(categories, criteria(['leadership'], [], ['scrum']));
      expect(result).toEqual([]);
    });

    it('un id de categoría en excludeIds no tiene efecto', () => {
      const result = selectSkillCategories(categories, criteria(['java'], [], ['c1']));
      expect(result.map((c) => c.id)).toEqual(['c1']);
      expect(result[0].skills.map((s) => s.id)).toEqual(['java']);
    });

    it('un id de categoría en includeIds tampoco fuerza sus skills', () => {
      const result = selectSkillCategories(categories, criteria(['leadership'], ['c1'], []));
      expect(result.map((c) => c.id)).toEqual(['c2']);
    });
  });
});
