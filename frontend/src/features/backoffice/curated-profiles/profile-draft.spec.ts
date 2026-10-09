import { describe, expect, it } from 'vitest';
import { makeAdminCuratedProfile } from '@/test/fixtures/admin';
import type { AdminExperience, AdminSkillCategory } from '../shared/admin-types';
import {
  allSections,
  EMPTY_DRAFT,
  moveSection,
  previewKey,
  tagUniverse,
  toDraft,
  toPreviewBody,
  toProfileBody,
  validateDraft,
  type ProfileDraft,
} from './profile-draft';

const draft = (overrides: Partial<ProfileDraft> = {}): ProfileDraft => ({
  ...EMPTY_DRAFT,
  slug: 'acme-backend',
  title: { es: 'Backend', en: 'Backend' },
  headline: { es: 'Titular', en: '' },
  ...overrides,
});

describe('validateDraft', () => {
  it('exige slug kebab-case y título; el titular es opcional', () => {
    expect(validateDraft(draft())).toEqual({});
    expect(validateDraft(draft({ slug: '' })).slug).toBe('El slug es obligatorio');
    expect(validateDraft(draft({ slug: 'No Kebab' })).slug).toMatch(/kebab-case/);
    expect(validateDraft(draft({ title: { es: '  ', en: 'x' } })).title).toBeDefined();
    expect(validateDraft(draft({ headline: { es: '', en: '' } })).headline).toBeUndefined();
    expect(
      validateDraft(draft({ headline: { es: '', en: 'Only english' } })).headline,
    ).toBeDefined();
  });

  it('un perfil PROTECTED necesita token; los demás no', () => {
    expect(validateDraft(draft({ visibility: 'PROTECTED' })).accessToken).toBeDefined();
    expect(
      validateDraft(draft({ visibility: 'PROTECTED', accessToken: 'secreto' })).accessToken,
    ).toBeUndefined();
    expect(validateDraft(draft({ visibility: 'PRIVATE' })).accessToken).toBeUndefined();
  });
});

describe('toProfileBody', () => {
  it('convierte textos vacíos en null y omite el inglés vacío', () => {
    const body = toProfileBody(draft());
    expect(body.description).toBeNull();
    expect(body.roleType).toBeNull();
    expect(body.techFocus).toBeNull();
    expect(body.headline).toEqual({ es: 'Titular' });
    expect(body.title).toEqual({ es: 'Backend', en: 'Backend' });
  });

  it('el token solo viaja cuando el perfil es PROTECTED', () => {
    expect(toProfileBody(draft({ accessToken: 'x' })).accessToken).toBeNull();
    expect(toProfileBody(draft({ visibility: 'PROTECTED', accessToken: ' x ' })).accessToken).toBe(
      'x',
    );
  });
});

describe('toPreviewBody', () => {
  it('omite el slug vacío o inválido, que el backend rechazaría', () => {
    expect(toPreviewBody(draft({ slug: '' }))).not.toHaveProperty('slug');
    expect(toPreviewBody(draft({ slug: '  ' }))).not.toHaveProperty('slug');
    expect(toPreviewBody(draft({ slug: 'mi-' }))).not.toHaveProperty('slug');
    expect(toPreviewBody(draft({ slug: 'Mi Perfil' }))).not.toHaveProperty('slug');
  });

  it('manda el slug válido, recortado', () => {
    expect(toPreviewBody(draft({ slug: ' acme-backend ' }))).toMatchObject({
      slug: 'acme-backend',
    });
  });

  it('nunca manda el token de acceso', () => {
    const body = toPreviewBody(
      draft({ visibility: 'PROTECTED', accessToken: 'secreto-largo-123' }),
    );
    expect(body.accessToken).toBeNull();
  });
});

describe('previewKey', () => {
  it('no cambia con el slug (no altera la vista)', () => {
    expect(previewKey(draft({ slug: 'a' }))).toBe(previewKey(draft({ slug: 'acme-backend' })));
  });

  it('cambia con los criterios de selección', () => {
    const base = previewKey(draft());
    expect(previewKey(draft({ filterTags: ['java'] }))).not.toBe(base);
    expect(previewKey(draft({ excludeIds: ['e1'] }))).not.toBe(base);
    expect(previewKey(draft({ layout: 'sidebar' }))).not.toBe(base);
    expect(previewKey(draft({ sectionsHidden: ['stats'] }))).not.toBe(base);
  });

  it('no cambia con los tokens del tema (los aplica el cliente)', () => {
    const base = previewKey(draft());
    expect(previewKey(draft({ themeOverrides: { colors: { accent: '#f00' } } }))).toBe(base);
  });

  it('no depende del orden en que se agregaron los tags', () => {
    expect(previewKey(draft({ filterTags: ['java', 'aws'] }))).toBe(
      previewKey(draft({ filterTags: ['aws', 'java'] })),
    );
  });
});

describe('tagUniverse', () => {
  const experiences = [
    { tags: ['java', 'aws'] },
    { tags: ['dotnet', 'java'] },
  ] as AdminExperience[];
  const categories = [
    { skills: [{ tags: ['leadership'] }, { tags: ['java'] }] },
  ] as AdminSkillCategory[];

  it('reúne los tags de experiencias y skills, sin repetir y ordenados', () => {
    expect(tagUniverse(experiences, categories)).toEqual(['aws', 'dotnet', 'java', 'leadership']);
  });

  it('incluye los tags extra ya elegidos aunque no existan en los datos', () => {
    expect(tagUniverse([], [], ['nuevo'])).toEqual(['nuevo']);
    expect(tagUniverse()).toEqual([]);
  });
});

describe('moveSection', () => {
  it('mueve arriba y abajo', () => {
    expect(moveSection(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveSection(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
  });

  it('en los extremos no hace nada y no muta el original', () => {
    const original = ['a', 'b'];
    expect(moveSection(original, 0, -1)).toEqual(['a', 'b']);
    expect(moveSection(original, 1, 1)).toEqual(['a', 'b']);
    expect(original).toEqual(['a', 'b']);
  });
});

describe('allSections', () => {
  it('respeta el orden del perfil y agrega al final las conocidas que faltan', () => {
    const result = allSections(['hero', 'skills']);
    expect(result.slice(0, 2)).toEqual(['hero', 'skills']);
    expect(result).toContain('projects');
    expect(result).toContain('presence');
    expect(new Set(result).size).toBe(result.length);
  });

  it('ofrece las nueve secciones del catálogo', () => {
    expect(allSections([])).toHaveLength(9);
  });
});

describe('toDraft', () => {
  it('una fila anterior a la validación pierde al cargar los ids fuera del catálogo', () => {
    const result = toDraft(
      makeAdminCuratedProfile({
        sectionsOrder: ['hero', 'timeline-3d', 'experience'],
        sectionsHidden: ['proyectos', 'stats'],
      }),
    );
    expect(result.sectionsOrder).toEqual(['hero', 'experience']);
    expect(result.sectionsHidden).toEqual(['stats']);
  });

  it('sin orden guardado arranca con el catálogo completo', () => {
    expect(toDraft(makeAdminCuratedProfile({ sectionsOrder: [] })).sectionsOrder).toHaveLength(9);
  });
});
