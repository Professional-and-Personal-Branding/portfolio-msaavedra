import { ThemeRecord, toThemeEntity } from './theme.prisma-mapper';

const record: ThemeRecord = {
  id: 't1',
  name: 'Modern Dark',
  slug: 'modern-dark',
  isPreset: true,
  tokens: { mode: 'dark', colors: { bg: '#000' } },
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('toThemeEntity', () => {
  it('mapea tokens como objeto plano', () => {
    const theme = toThemeEntity(record);
    expect(theme.slug).toBe('modern-dark');
    expect(theme.tokens).toEqual({ mode: 'dark', colors: { bg: '#000' } });
  });

  it('tokens con forma inesperada → {}', () => {
    expect(toThemeEntity({ ...record, tokens: 'nope' }).tokens).toEqual({});
    expect(toThemeEntity({ ...record, tokens: [1, 2] }).tokens).toEqual({});
  });
});
