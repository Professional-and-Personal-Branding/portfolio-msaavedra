import { matchesAnyTag, selectByTags, Taggable } from './select-by-tags';

const item = (id: string, ...tags: string[]): Taggable => ({ id, tags });
const ids = (items: readonly Taggable[]) => items.map((i) => i.id);
const criteria = (
  filterTags: string[] = [],
  includeIds: string[] = [],
  excludeIds: string[] = [],
) => ({ filterTags, includeIds, excludeIds });

describe('matchesAnyTag', () => {
  it('basta compartir un tag', () => {
    expect(matchesAnyTag(['java', 'fintech'], ['java', 'spring-boot'])).toBe(true);
  });
  it('sin intersección → false', () => {
    expect(matchesAnyTag(['dotnet', 'legacy'], ['java'])).toBe(false);
  });
  it('filterTags vacío → todo pasa', () => {
    expect(matchesAnyTag(['x'], [])).toBe(true);
    expect(matchesAnyTag([], [])).toBe(true);
  });
  it('item sin tags con filtro → false', () => {
    expect(matchesAnyTag([], ['java'])).toBe(false);
  });
});

describe('selectByTags (spec curated-profile-resolution)', () => {
  const items = [
    item('novacomp', 'dotnet', 'java', 'fintech'),
    item('ypfb', 'dotnet', 'legacy'),
    item('kiwox', 'nodejs', 'aws'),
    item('nsoft', 'java', 'telecom'),
  ];

  it('incluye los que comparten al menos un tag', () => {
    expect(ids(selectByTags(items, criteria(['java'])))).toEqual(['novacomp', 'nsoft']);
  });

  it('excluye los que no comparten ninguno', () => {
    expect(ids(selectByTags(items, criteria(['java'])))).not.toContain('ypfb');
  });

  it('filterTags vacío incluye todo', () => {
    expect(ids(selectByTags(items, criteria([])))).toEqual(ids(items));
  });

  it('excludeIds prevalece sobre el match por tag', () => {
    expect(ids(selectByTags(items, criteria(['java'], [], ['novacomp'])))).toEqual(['nsoft']);
  });

  it('includeIds fuerza la inclusión aunque no matchee', () => {
    expect(ids(selectByTags(items, criteria(['java'], ['kiwox'])))).toEqual([
      'novacomp',
      'kiwox',
      'nsoft',
    ]);
  });

  it('conflicto include/exclude → excluido', () => {
    expect(ids(selectByTags(items, criteria(['java'], ['kiwox'], ['kiwox'])))).toEqual([
      'novacomp',
      'nsoft',
    ]);
  });

  it('ids inexistentes se ignoran sin error', () => {
    expect(ids(selectByTags(items, criteria(['java'], ['zzz'], ['yyy'])))).toEqual([
      'novacomp',
      'nsoft',
    ]);
  });

  it('excludeIds también aplica con filterTags vacío', () => {
    expect(ids(selectByTags(items, criteria([], [], ['ypfb'])))).toEqual([
      'novacomp',
      'kiwox',
      'nsoft',
    ]);
  });

  it('conserva el orden de entrada y no muta', () => {
    const input = [...items];
    const result = selectByTags(input, criteria(['dotnet', 'nodejs']));
    expect(ids(result)).toEqual(['novacomp', 'ypfb', 'kiwox']);
    expect(input).toEqual(items);
  });

  it('lista vacía → lista vacía', () => {
    expect(selectByTags([], criteria(['java'], ['a'], ['b']))).toEqual([]);
  });
});

describe('selectByTags con ids de distintos tipos en el mismo arreglo', () => {
  // Skills y proyectos comparten includeIds/excludeIds (D2 de add-builder-skill-project-overrides).
  const skills = [item('skill-java', 'java'), item('skill-react', 'frontend')];
  const projects = [item('proj-erp', 'java'), item('proj-web', 'frontend')];
  const shared = criteria(['java'], ['skill-react'], ['proj-erp']);

  it('cada lista solo reacciona a sus propios ids', () => {
    expect(ids(selectByTags(skills, shared))).toEqual(['skill-java', 'skill-react']);
    expect(ids(selectByTags(projects, shared))).toEqual([]);
  });

  it('un id ajeno no altera el resultado', () => {
    expect(ids(selectByTags(skills, criteria(['java'], ['proj-web'], ['proj-erp'])))).toEqual([
      'skill-java',
    ]);
  });
});
