import { CuratedProfileRecord, toCuratedProfileEntity } from './curated-profile.prisma-mapper';

const record: CuratedProfileRecord = {
  id: 'cp1',
  slug: 'tech-lead-dotnet',
  title: { es: 'Tech Lead', en: 'Tech Lead' },
  headline: { es: 'T', en: 'H' },
  description: null,
  roleType: { es: 'Tech Lead', en: 'Tech Lead' },
  techFocus: '.NET',
  filterTags: ['leadership', 'dotnet'],
  includeIds: ['a'],
  excludeIds: ['b'],
  accentColor: '#5B2C87',
  themeId: 't1',
  themeOverrides: { colors: { accent: '#fff' } },
  layout: 'classic',
  sectionsOrder: ['hero'],
  sectionsHidden: [],
  visibility: 'PROTECTED',
  accessToken: 'tok',
  views: 3,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('toCuratedProfileEntity', () => {
  it('mapea el registro completo, incluido el token y la visibilidad', () => {
    const cp = toCuratedProfileEntity(record);
    expect(cp.slug).toBe('tech-lead-dotnet');
    expect(cp.filterTags).toEqual(['leadership', 'dotnet']);
    expect(cp.visibility).toBe('PROTECTED');
    expect(cp.canAccess('tok')).toBe(true);
    expect(cp.canAccess('x')).toBe(false);
    expect(cp.themeOverrides).toEqual({ colors: { accent: '#fff' } });
    expect(cp.description).toEqual({});
  });

  it('visibilidad desconocida se degrada a PRIVATE y JSON malformado a vacío', () => {
    const cp = toCuratedProfileEntity({
      ...record,
      visibility: 'WEIRD' as never,
      title: 42,
      accessToken: null,
    });
    expect(cp.visibility).toBe('PRIVATE');
    expect(cp.title).toEqual({});
    expect(cp.canAccess('tok')).toBe(false);
  });
});
