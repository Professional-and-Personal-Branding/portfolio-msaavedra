import { describe, expect, it } from 'vitest';
import {
  makeAdminExperience,
  makeAdminProject,
  makeAdminRepository,
  ADMIN_CATEGORIES,
} from '@/test/fixtures/admin';
import type { AdminSkillCategory } from '../shared/admin-types';
import { EMPTY_DRAFT, type ProfileDraft } from './profile-draft';
import {
  categoryOverrideCounts,
  filterSkillCategories,
  hasOverrideConflict,
  orphanOverrideIds,
  overrideState,
  removeOverrideIds,
  setOverride,
} from './selection-overrides';

const draft = (includeIds: string[] = [], excludeIds: string[] = []): ProfileDraft => ({
  ...EMPTY_DRAFT,
  includeIds,
  excludeIds,
});

describe('overrideState y setOverride', () => {
  it('incluir, excluir e incluir de nuevo mueve el id entre los arreglos', () => {
    let current = draft();
    current = setOverride(current, 'sk-1', 'include');
    expect(current).toMatchObject({ includeIds: ['sk-1'], excludeIds: [] });
    current = setOverride(current, 'sk-1', 'exclude');
    expect(current).toMatchObject({ includeIds: [], excludeIds: ['sk-1'] });
    expect(overrideState(current, 'sk-1')).toBe('exclude');
    current = setOverride(current, 'sk-1', 'include');
    expect(current).toMatchObject({ includeIds: ['sk-1'], excludeIds: [] });
    expect(overrideState(current, 'sk-1')).toBe('include');
  });

  it('none lo quita de los dos arreglos y conserva los demás ids', () => {
    const current = draft(['a', 'b'], ['c', 'b']);
    const next = setOverride(current, 'b', 'none');
    expect(next).toMatchObject({ includeIds: ['a'], excludeIds: ['c'] });
    expect(overrideState(next, 'b')).toBe('none');
  });

  it('no duplica ids ni muta el borrador original', () => {
    const current = draft(['a']);
    const next = setOverride(setOverride(current, 'a', 'include'), 'a', 'include');
    expect(next.includeIds).toEqual(['a']);
    expect(current.includeIds).toEqual(['a']);
    expect(setOverride(current, 'z', 'exclude')).not.toBe(current);
    expect(current.excludeIds).toEqual([]);
  });

  it('un id en ambos arreglos se ve como excluido, y incluir lo deja solo en includeIds', () => {
    const current = draft(['x'], ['x']);
    expect(overrideState(current, 'x')).toBe('exclude');
    expect(hasOverrideConflict(current, 'x')).toBe(true);
    const fixed = setOverride(current, 'x', 'include');
    expect(fixed).toMatchObject({ includeIds: ['x'], excludeIds: [] });
    expect(hasOverrideConflict(fixed, 'x')).toBe(false);
  });

  it('un id desconocido está en none', () => {
    expect(overrideState(draft(['a'], ['b']), 'z')).toBe('none');
  });
});

describe('orphanOverrideIds y removeOverrideIds', () => {
  const experiences = [makeAdminExperience({ id: 'exp-1' })];
  const projects = [makeAdminProject({ id: 'proj-1' })];
  const repositories = [makeAdminRepository({ id: 'repo-1' })];

  it('solo devuelve el id que no existe en ninguna lista, uno de cada tipo existente no cuenta', () => {
    const current = draft(['exp-1', 'sk-1', 'repo-1'], ['proj-1', 'borrado']);
    expect(
      orphanOverrideIds(current, experiences, ADMIN_CATEGORIES, projects, repositories),
    ).toEqual(['borrado']);
  });

  it('un repositorio existente, visible u oculto, no es huérfano; uno borrado sí', () => {
    const hidden = [makeAdminRepository({ id: 'repo-oculto', visible: false })];
    const current = draft(['repo-oculto'], ['repo-borrado']);
    expect(orphanOverrideIds(current, experiences, ADMIN_CATEGORIES, projects, hidden)).toEqual([
      'repo-borrado',
    ]);
  });

  it('no repite un id huérfano presente en los dos arreglos', () => {
    const current = draft(['viejo'], ['viejo']);
    expect(
      orphanOverrideIds(current, experiences, ADMIN_CATEGORIES, projects, repositories),
    ).toEqual(['viejo']);
  });

  it('sin overrides no hay huérfanos', () => {
    expect(
      orphanOverrideIds(draft(), experiences, ADMIN_CATEGORIES, projects, repositories),
    ).toEqual([]);
  });

  it('removeOverrideIds saca los ids de los dos arreglos y conserva el resto', () => {
    const current = draft(['a', 'viejo'], ['b', 'viejo']);
    expect(removeOverrideIds(current, ['viejo'])).toMatchObject({
      includeIds: ['a'],
      excludeIds: ['b'],
    });
    expect(current.includeIds).toEqual(['a', 'viejo']);
  });
});

describe('filterSkillCategories', () => {
  const categories: AdminSkillCategory[] = [
    {
      id: 'c1',
      name: { es: 'Lenguajes' },
      order: 0,
      skills: [
        { id: 's1', categoryId: 'c1', name: 'Kotlin', tags: [], order: 0 },
        { id: 's2', categoryId: 'c1', name: 'Java', tags: [], order: 1 },
      ],
    },
    {
      id: 'c2',
      name: { es: 'Folklore' },
      order: 1,
      skills: [{ id: 's3', categoryId: 'c2', name: 'Ñandú', tags: [], order: 0 }],
    },
  ];

  it('busca por nombre sin distinguir mayúsculas y oculta las categorías sin coincidencias', () => {
    for (const query of ['kot', 'KOT', ' Kot ']) {
      const result = filterSkillCategories(categories, query);
      expect(result.map((c) => c.id)).toEqual(['c1']);
      expect(result[0]?.skills.map((s) => s.name)).toEqual(['Kotlin']);
    }
  });

  it('ignora los acentos en los dos sentidos', () => {
    expect(filterSkillCategories(categories, 'nandu').map((c) => c.id)).toEqual(['c2']);
    expect(filterSkillCategories(categories, 'ÑANDÚ').map((c) => c.id)).toEqual(['c2']);
  });

  it('una búsqueda vacía o de espacios devuelve todo, y no busca por categoría', () => {
    expect(filterSkillCategories(categories, '')).toHaveLength(2);
    expect(filterSkillCategories(categories, '   ')).toHaveLength(2);
    expect(filterSkillCategories(categories, 'lenguajes')).toEqual([]);
  });

  it('un texto sin coincidencias devuelve una lista vacía y no muta la entrada', () => {
    expect(filterSkillCategories(categories, 'zzz')).toEqual([]);
    expect(categories[0]?.skills).toHaveLength(2);
  });
});

describe('categoryOverrideCounts', () => {
  it('cuenta incluidas y excluidas de la categoría; un conflicto cuenta como excluida', () => {
    const lenguajes = ADMIN_CATEGORIES[0]!;
    expect(categoryOverrideCounts(draft(['sk-1'], ['sk-2']), lenguajes)).toEqual({
      included: 1,
      excluded: 1,
    });
    expect(categoryOverrideCounts(draft(['sk-1'], ['sk-1']), lenguajes)).toEqual({
      included: 0,
      excluded: 1,
    });
    expect(categoryOverrideCounts(draft(['sk-3']), lenguajes)).toEqual({
      included: 0,
      excluded: 0,
    });
  });
});
