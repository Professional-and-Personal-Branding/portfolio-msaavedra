import { DEFAULT_SECTIONS, resolveSections } from './resolve-sections';

describe('resolveSections', () => {
  it('orden personalizado con ocultas', () => {
    expect(resolveSections(['hero', 'skills', 'experience', 'contact'], ['skills'])).toEqual({
      sections: ['hero', 'experience', 'contact'],
      hiddenSections: ['skills'],
    });
  });

  it('orden vacío usa el default completo', () => {
    expect(resolveSections([], [])).toEqual({
      sections: [...DEFAULT_SECTIONS],
      hiddenSections: [],
    });
  });

  it('oculta inexistente no rompe y se deduplica', () => {
    const result = resolveSections([], ['nope', 'stats', 'stats']);
    expect(result.sections).toEqual(DEFAULT_SECTIONS.filter((s) => s !== 'stats'));
    expect(result.hiddenSections).toEqual(['nope', 'stats']);
  });
});
