import { ConflictError, ValidationError } from '../../../../../shared/domain/errors';
import { Theme } from '../../../../theme/domain/entities/theme.entity';
import { ThemeRepository } from '../../../../theme/domain/repositories/theme.repository';
import {
  CuratedProfile,
  NewCuratedProfileProps,
} from '../../../domain/entities/curated-profile.entity';
import { CuratedProfileNotFoundError } from '../../../domain/errors/curated-profile-not-found.error';
import { CuratedProfileRepository } from '../../../domain/repositories/curated-profile.repository';
import { AccessToken } from '../../../domain/value-objects/access-token.vo';
import {
  CreateCuratedProfileUseCase,
  DeleteCuratedProfileUseCase,
  GetCuratedProfileAdminUseCase,
  ListAllCuratedProfilesUseCase,
  UpdateCuratedProfileUseCase,
} from './curated-profile-admin.use-cases';

const NEW: NewCuratedProfileProps = {
  slug: 'qa-lead',
  title: { es: 'QA Lead' },
  headline: { es: 'Calidad' },
  description: null,
  roleType: null,
  techFocus: null,
  filterTags: ['testing'],
  includeIds: [],
  excludeIds: [],
  accentColor: '#1A365D',
  themeId: null,
  themeOverrides: null,
  layout: 'classic',
  sectionsOrder: [],
  sectionsHidden: [],
  visibility: 'PUBLIC',
  accessToken: AccessToken.none(),
};

const THEME = Theme.create({ id: 't1', name: 'X', slug: 'x', isPreset: true, tokens: {} });

function build(existing: CuratedProfile[] = []) {
  const store = [...existing];
  const repo: CuratedProfileRepository = {
    findBySlug: jest.fn(),
    findAllPublic: jest.fn(),
    findAll: jest.fn().mockImplementation(() => Promise.resolve([...store])),
    findById: jest
      .fn()
      .mockImplementation((id: string) => Promise.resolve(store.find((p) => p.id === id) ?? null)),
    existsBySlug: jest
      .fn()
      .mockImplementation((slug: string, excludeId?: string) =>
        Promise.resolve(store.some((p) => p.slug === slug && p.id !== excludeId)),
      ),
    create: jest.fn().mockImplementation((props: NewCuratedProfileProps) => {
      const p = CuratedProfile.create({ ...props, id: `cp-${store.length + 1}`, views: 0 });
      store.push(p);
      return Promise.resolve(p);
    }),
    update: jest.fn().mockImplementation((p: CuratedProfile) => {
      const i = store.findIndex((x) => x.id === p.id);
      if (i < 0) return Promise.resolve(null);
      store[i] = p;
      return Promise.resolve(p);
    }),
    delete: jest.fn().mockImplementation((id: string) => {
      const i = store.findIndex((x) => x.id === id);
      if (i < 0) return Promise.resolve(false);
      store.splice(i, 1);
      return Promise.resolve(true);
    }),
  };
  const themes: ThemeRepository = {
    findById: jest
      .fn()
      .mockImplementation((id: string) => Promise.resolve(id === 't1' ? THEME : null)),
    findBySlug: jest.fn(),
    findAll: jest.fn().mockResolvedValue([THEME]),
  };
  return { repo, themes, store };
}

const ALL = CuratedProfile.create({ ...NEW, id: 'all', slug: 'all', filterTags: [], views: 3 });

describe('Curated profile admin use cases (spec admin-curated-profile-crud)', () => {
  it('lista y obtiene con campos internos crudos (incluye accessToken, views)', async () => {
    const { repo } = build([
      CuratedProfile.create({
        ...NEW,
        id: 'p1',
        visibility: 'PROTECTED',
        accessToken: AccessToken.create('tok'),
        views: 5,
      }),
    ]);
    const list = await new ListAllCuratedProfilesUseCase(repo).execute();
    expect(list.value[0]).toMatchObject({
      filterTags: ['testing'],
      includeIds: [],
      excludeIds: [],
      visibility: 'PROTECTED',
      accessToken: 'tok',
      views: 5,
    });
    const one = await new GetCuratedProfileAdminUseCase(repo).execute({ id: 'p1' });
    expect(one.ok).toBe(true);
    const missing = await new GetCuratedProfileAdminUseCase(repo).execute({ id: 'zz' });
    expect(missing.ok).toBe(false);
  });

  it('create: mínimo válido; slug duplicado → Conflict; slug inválido / PROTECTED sin token / themeId inexistente → Validation', async () => {
    const { repo, themes, store } = build([ALL]);
    const useCase = new CreateCuratedProfileUseCase(repo, themes);

    const created = await useCase.execute(NEW);
    expect(created.ok).toBe(true);
    if (created.ok) expect(created.value.slug).toBe('qa-lead');
    expect(store).toHaveLength(2);

    const dup = await useCase.execute({ ...NEW, slug: 'all' });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error).toBeInstanceOf(ConflictError);

    const badSlug = await useCase.execute({ ...NEW, slug: 'QA Lead!' });
    expect(badSlug.ok).toBe(false);
    if (!badSlug.ok) expect(badSlug.error).toBeInstanceOf(ValidationError);

    const noToken = await useCase.execute({ ...NEW, slug: 'p2', visibility: 'PROTECTED' });
    expect(noToken.ok).toBe(false);
    if (!noToken.ok) expect((noToken.error as ValidationError).fields).toContain('accessToken');

    const badTheme = await useCase.execute({ ...NEW, slug: 'p3', themeId: 'no-existe' });
    expect(badTheme.ok).toBe(false);
    if (!badTheme.ok) expect(badTheme.error.message).toContain('themeId');

    const withTheme = await useCase.execute({ ...NEW, slug: 'p4', themeId: 't1' });
    expect(withTheme.ok).toBe(true);
  });

  it('update: filtros/overrides, PROTECTED con y sin token, slug ocupado, 404', async () => {
    const p1 = CuratedProfile.create({ ...NEW, id: 'p1', views: 0 });
    const { repo, themes } = build([ALL, p1]);
    const useCase = new UpdateCuratedProfileUseCase(repo, themes);

    const filters = await useCase.execute({
      id: 'p1',
      changes: { filterTags: ['ruby'], includeIds: ['a'], excludeIds: ['b'] },
    });
    expect(filters.ok).toBe(true);
    if (filters.ok) {
      expect(filters.value.filterTags).toEqual(['ruby']);
      expect(filters.value.includeIds).toEqual(['a']);
      expect(filters.value.excludeIds).toEqual(['b']);
      expect(filters.value.slug).toBe('qa-lead');
    }

    const protectedNoToken = await useCase.execute({
      id: 'p1',
      changes: { visibility: 'PROTECTED' },
    });
    expect(protectedNoToken.ok).toBe(false);
    if (!protectedNoToken.ok) expect(protectedNoToken.error).toBeInstanceOf(ValidationError);

    const protectedOk = await useCase.execute({
      id: 'p1',
      changes: { visibility: 'PROTECTED', accessToken: AccessToken.create('abc123') },
    });
    expect(protectedOk.ok).toBe(true);
    if (protectedOk.ok) expect(protectedOk.value.accessToken).toBe('abc123');

    const slugTaken = await useCase.execute({ id: 'p1', changes: { slug: 'all' } });
    expect(slugTaken.ok).toBe(false);
    if (!slugTaken.ok) expect(slugTaken.error).toBeInstanceOf(ConflictError);

    const sameSlug = await useCase.execute({ id: 'p1', changes: { slug: 'qa-lead' } });
    expect(sameSlug.ok).toBe(true); // su propio slug no cuenta como conflicto

    const missing = await useCase.execute({ id: 'zz', changes: {} });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toBeInstanceOf(CuratedProfileNotFoundError);
  });

  it('delete: existente → ok; inexistente → 404', async () => {
    const { repo } = build([ALL]);
    expect((await new DeleteCuratedProfileUseCase(repo).execute({ id: 'all' })).ok).toBe(true);
    expect((await new DeleteCuratedProfileUseCase(repo).execute({ id: 'all' })).ok).toBe(false);
  });
});
