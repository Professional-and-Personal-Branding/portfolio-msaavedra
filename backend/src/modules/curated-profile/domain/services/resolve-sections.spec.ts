import {
  completeSections,
  DEFAULT_SECTIONS,
  isSectionId,
  MIN_REPOSITORIES_FOR_SECTION,
  resolveSections,
  SECTION_IDS,
  SectionId,
} from './resolve-sections';

describe('SECTION_IDS', () => {
  it('son los diez ids en orden canónico', () => {
    expect(SECTION_IDS).toEqual([
      'hero',
      'stats',
      'experience',
      'skills',
      'projects',
      'repositories',
      'education',
      'certifications',
      'presence',
      'contact',
    ]);
  });

  it('DEFAULT_SECTIONS es el mismo catálogo', () => {
    expect(DEFAULT_SECTIONS).toBe(SECTION_IDS);
  });

  it.each([
    ['hero', true],
    ['presence', true],
    ['heroe', false],
    ['', false],
  ])('isSectionId(%j) → %s', (value, expected) => {
    expect(isSectionId(value)).toBe(expected);
  });
});

describe('resolveSections', () => {
  it('orden personalizado con ocultas', () => {
    expect(resolveSections(['hero', 'skills', 'experience', 'contact'], ['skills'])).toEqual({
      sections: ['hero', 'experience', 'contact'],
      hiddenSections: ['skills'],
    });
  });

  it('orden vacío usa el catálogo completo', () => {
    expect(resolveSections([], [])).toEqual({
      sections: [...SECTION_IDS],
      hiddenSections: [],
    });
  });

  it('oculta inexistente no rompe y se deduplica', () => {
    const result = resolveSections([], ['nope', 'stats', 'stats']);
    expect(result.sections).toEqual(SECTION_IDS.filter((s) => s !== 'stats'));
    expect(result.hiddenSections).toEqual(['nope', 'stats']);
  });
});

describe('completeSections', () => {
  const all = new Set<SectionId>(SECTION_IDS);
  const complete = (order: string[], hidden: string[], withData: Set<SectionId> = all) =>
    completeSections(resolveSections(order, hidden), withData);

  it('orden parcial: agrega al final las que tienen datos, en orden canónico', () => {
    expect(complete(['hero', 'experience'], [])).toEqual([
      'hero',
      'experience',
      'stats',
      'skills',
      'projects',
      'repositories',
      'education',
      'certifications',
      'presence',
      'contact',
    ]);
  });

  it('orden completo: no agrega nada ni lo reordena', () => {
    const order = [...SECTION_IDS].reverse();
    expect(complete(order, [])).toEqual(order);
  });

  it('id repetido: aparece una sola vez', () => {
    expect(complete(['hero', 'hero', 'experience'], [], new Set(['hero', 'experience']))).toEqual([
      'hero',
      'experience',
    ]);
  });

  it('orden vacío: el catálogo, menos lo que no tiene datos', () => {
    expect(complete([], [], new Set(['hero', 'projects', 'contact']))).toEqual([
      'hero',
      'projects',
      'contact',
    ]);
  });

  it('el orden declarado va primero y no se altera', () => {
    expect(complete(['contact', 'hero', 'experience'], []).slice(0, 3)).toEqual([
      'contact',
      'hero',
      'experience',
    ]);
  });

  it('una sección sin datos no aparece, aunque esté declarada', () => {
    expect(complete(['hero', 'projects'], [], new Set(['hero']))).toEqual(['hero']);
  });

  it('una sección oculta no se rellena', () => {
    const result = complete(['hero'], ['projects']);
    expect(result).not.toContain('projects');
    expect(result).toContain('presence');
  });

  it('un id fuera del catálogo se descarta', () => {
    expect(complete(['hero', 'timeline-3d'], [], new Set(['hero']))).toEqual(['hero']);
  });

  it('repositories va entre projects y education en el orden por defecto', () => {
    const result = complete([], []);
    expect(result).toHaveLength(10);
    expect(result.indexOf('repositories')).toBe(result.indexOf('projects') + 1);
    expect(result.indexOf('education')).toBe(result.indexOf('repositories') + 1);
  });

  it('con un orden explícito sin repositories, se rellena al final', () => {
    const result = complete(['hero', 'experience'], []);
    expect(result.slice(0, 2)).toEqual(['hero', 'experience']);
    expect(result).toContain('repositories');
    expect(result.indexOf('repositories')).toBeGreaterThan(1);
  });
});

describe('MIN_REPOSITORIES_FOR_SECTION', () => {
  it('es 2', () => {
    expect(MIN_REPOSITORIES_FOR_SECTION).toBe(2);
  });
});
