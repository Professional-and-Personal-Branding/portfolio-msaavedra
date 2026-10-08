import { ValidationError } from '../../../../../shared/domain/errors';
import { NewSocialLinkProps, SocialLink } from '../../../domain/entities/social-link.entity';
import { SocialLinkNotFoundError } from '../../../domain/errors/social-link-not-found.error';
import { SocialLinkRepository } from '../../../domain/repositories/social-link.repository';
import {
  CreateSocialLinkUseCase,
  DeleteSocialLinkUseCase,
  GetSocialLinkAdminUseCase,
  ListAllSocialLinksUseCase,
  UpdateSocialLinkUseCase,
} from './social-link-admin.use-cases';

const NEW: NewSocialLinkProps = {
  platform: 'github',
  handle: 'manu',
  url: 'https://github.com/manu',
  label: { es: 'Código', en: 'Code' },
  description: null,
  stats: { repos: 67, achievements: ['Pull Shark'] },
  featured: true,
  order: 0,
  visible: true,
};

function repoWith(items: SocialLink[]): SocialLinkRepository & { store: SocialLink[] } {
  const store = [...items];
  return {
    store,
    findAllVisible: jest.fn(),
    findAll: jest.fn().mockImplementation(() => Promise.resolve([...store])),
    findById: jest
      .fn()
      .mockImplementation((id: string) => Promise.resolve(store.find((s) => s.id === id) ?? null)),
    create: jest.fn().mockImplementation((props: NewSocialLinkProps) => {
      const created = SocialLink.create({ ...props, id: `new-${store.length + 1}` });
      store.push(created);
      return Promise.resolve(created);
    }),
    update: jest.fn().mockImplementation((s: SocialLink) => {
      const i = store.findIndex((x) => x.id === s.id);
      if (i < 0) return Promise.resolve(null);
      store[i] = s;
      return Promise.resolve(s);
    }),
    delete: jest.fn().mockImplementation((id: string) => {
      const i = store.findIndex((x) => x.id === id);
      if (i < 0) return Promise.resolve(false);
      store.splice(i, 1);
      return Promise.resolve(true);
    }),
  };
}

const hidden = SocialLink.create({ ...NEW, id: 'h', platform: 'youtube', visible: false });
const shown = SocialLink.create({ ...NEW, id: 'v' });

describe('SocialLink admin use cases (spec admin-content-management)', () => {
  it('lista todos, incluidos los ocultos, con datos bilingües crudos y stats', async () => {
    const result = await new ListAllSocialLinksUseCase(repoWith([shown, hidden])).execute();
    expect(result.value.map((s) => s.id)).toEqual(['v', 'h']);
    expect(result.value[1].visible).toBe(false);
    expect(result.value[0].label).toEqual({ es: 'Código', en: 'Code' });
    expect(result.value[0].stats).toEqual({ repos: 67, achievements: ['Pull Shark'] });
    expect(result.value[0]).toMatchObject({ featured: true, order: 0 });
  });

  it('get: existente y 404', async () => {
    const repo = repoWith([shown]);
    expect((await new GetSocialLinkAdminUseCase(repo).execute({ id: 'v' })).ok).toBe(true);
    const missing = await new GetSocialLinkAdminUseCase(repo).execute({ id: 'zz' });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toBeInstanceOf(SocialLinkNotFoundError);
  });

  it('create: válido → creado; url relativa → ValidationError sin persistir', async () => {
    const repo = repoWith([]);
    const created = await new CreateSocialLinkUseCase(repo).execute(NEW);
    expect(created.ok).toBe(true);
    if (created.ok) expect(created.value.url).toBe('https://github.com/manu');

    const bad = await new CreateSocialLinkUseCase(repo).execute({ ...NEW, url: '/relativa' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toBeInstanceOf(ValidationError);
    expect(repo.store).toHaveLength(1);
  });

  it('update: parcial conserva el resto; valida el estado resultante; 404', async () => {
    const repo = repoWith([shown]);
    const useCase = new UpdateSocialLinkUseCase(repo);

    const r = await useCase.execute({ id: 'v', changes: { stats: null, visible: false } });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.stats).toBeNull();
      expect(r.value.visible).toBe(false);
      expect(r.value.handle).toBe('manu');
      expect(r.value.label).toEqual({ es: 'Código', en: 'Code' });
    }

    const invalid = await useCase.execute({ id: 'v', changes: { platform: 'Git Hub' } });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error).toBeInstanceOf(ValidationError);
    expect(repo.store[0].platform).toBe('github');

    const missing = await useCase.execute({ id: 'zz', changes: {} });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toBeInstanceOf(SocialLinkNotFoundError);
  });

  it('delete: existente → ok; inexistente → 404', async () => {
    const repo = repoWith([shown]);
    expect((await new DeleteSocialLinkUseCase(repo).execute({ id: 'v' })).ok).toBe(true);
    expect(repo.store).toHaveLength(0);
    const again = await new DeleteSocialLinkUseCase(repo).execute({ id: 'v' });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toBeInstanceOf(SocialLinkNotFoundError);
  });
});
