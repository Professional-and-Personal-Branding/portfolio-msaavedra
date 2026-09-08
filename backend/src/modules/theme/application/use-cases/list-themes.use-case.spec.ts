import { Theme } from '../../domain/entities/theme.entity';
import { ThemeRepository } from '../../domain/repositories/theme.repository';
import { ListThemesUseCase } from './list-themes.use-case';

const MODERN_DARK = Theme.create({
  id: 't-md',
  name: 'Modern Dark',
  slug: 'modern-dark',
  isPreset: true,
  tokens: { mode: 'dark', colors: { bg: '#0a0e1a', accent: '#38bdf8' } },
});
const CUSTOM = Theme.create({
  id: 't-cu',
  name: 'Acme',
  slug: 'acme',
  isPreset: false,
  tokens: { mode: 'light' },
});

function build(themes: Theme[]) {
  const repo: ThemeRepository = {
    findById: jest.fn(),
    findBySlug: jest.fn(),
    findAll: jest.fn().mockResolvedValue(themes),
  };
  return { useCase: new ListThemesUseCase(repo), repo };
}

describe('ListThemesUseCase', () => {
  it('devuelve id, slug, nombre, isPreset y tokens de cada tema', async () => {
    const { useCase } = build([MODERN_DARK, CUSTOM]);
    const result = await useCase.execute();

    expect(result.value).toEqual([
      {
        id: 't-md',
        slug: 'modern-dark',
        name: 'Modern Dark',
        isPreset: true,
        tokens: { mode: 'dark', colors: { bg: '#0a0e1a', accent: '#38bdf8' } },
      },
      { id: 't-cu', slug: 'acme', name: 'Acme', isPreset: false, tokens: { mode: 'light' } },
    ]);
  });

  it('respeta el orden del repositorio y devuelve lista vacía sin temas', async () => {
    const { useCase } = build([CUSTOM, MODERN_DARK]);
    expect((await useCase.execute()).value.map((t) => t.slug)).toEqual(['acme', 'modern-dark']);
    expect((await build([]).useCase.execute()).value).toEqual([]);
  });

  it('los tokens devueltos son copias: mutarlos no afecta al tema', async () => {
    const { useCase } = build([MODERN_DARK]);
    const first = (await useCase.execute()).value[0];
    (first.tokens as { mode: string }).mode = 'light';

    const second = (await useCase.execute()).value[0];
    expect(second.tokens.mode).toBe('dark');
  });
});
