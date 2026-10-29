import { Clock } from '../../../../../shared/domain/clock';
import { ConflictError } from '../../../../../shared/domain/errors';
import { fail, ok } from '../../../../../shared/domain/result';
import { ProfileViewRepository } from '../../../../analytics/domain/repositories/profile-view.repository';
import {
  CuratedProfile,
  CuratedProfileProps,
} from '../../../domain/entities/curated-profile.entity';
import { NewShareLinkProps, ShareLink } from '../../../domain/entities/share-link.entity';
import { ShareCodeCollisionError } from '../../../domain/errors/share-code-collision.error';
import { CuratedProfileRepository } from '../../../domain/repositories/curated-profile.repository';
import { ShareLinkRepository } from '../../../domain/repositories/share-link.repository';
import { AccessToken } from '../../../domain/value-objects/access-token.vo';
import {
  CreateShareLinkUseCase,
  GetOrCreateLinkedInShareLinkUseCase,
  LINKEDIN_LABEL,
  ListShareLinksUseCase,
  RenameShareLinkUseCase,
  RevokeShareLinkUseCase,
  SHARE_CODE_ATTEMPTS,
} from './share-links.use-cases';

const PROFILE: CuratedProfileProps = {
  id: 'cp1',
  slug: 'acme-lead',
  title: { es: 'Acme Lead' },
  headline: { es: 'Titular' },
  description: null,
  roleType: null,
  techFocus: null,
  filterTags: [],
  includeIds: [],
  excludeIds: [],
  themeId: null,
  themeOverrides: null,
  layout: 'classic',
  sectionsOrder: [],
  sectionsHidden: [],
  visibility: 'PUBLIC',
  accessToken: AccessToken.none(),
  views: 0,
};

const NOW = new Date('2026-10-29T12:00:00Z');
const clock: Clock = { now: () => NOW };

/** Repositorios en memoria: lo justo para observar lo que hacen los casos de uso. */
function build(profiles: CuratedProfileProps[] = [PROFILE], codes: string[] = ['aaaaaaaaaa']) {
  const profileStore = new Map(profiles.map((p) => [p.id, CuratedProfile.create(p)]));
  const store = new Map<string, ShareLink>();
  let seq = 0;
  const taken = new Set<string>();
  const create = jest.fn((props: NewShareLinkProps) => {
    if (taken.has(props.code)) return Promise.resolve(fail(new ShareCodeCollisionError()));
    taken.add(props.code);
    seq += 1;
    const link = new ShareLink({
      ...props,
      id: `sl${seq}`,
      createdAt: new Date(NOW.getTime() + seq),
      revokedAt: null,
    });
    store.set(link.id, link);
    return Promise.resolve(ok(link));
  });
  const links: ShareLinkRepository = {
    findByCode: jest.fn(),
    findById: jest.fn((id: string) => Promise.resolve(store.get(id) ?? null)),
    listByProfile: jest.fn((profileId: string) =>
      Promise.resolve(
        [...store.values()]
          .filter((l) => l.curatedProfileId === profileId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      ),
    ),
    create,
    save: jest.fn((link: ShareLink) => {
      store.set(link.id, link);
      return Promise.resolve(link);
    }),
    findActiveLinkedIn: jest.fn((profileId: string) =>
      Promise.resolve(
        [...store.values()]
          .filter(
            (l) => l.curatedProfileId === profileId && l.kind === 'LINKEDIN_POST' && l.isActive(),
          )
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null,
      ),
    ),
  };
  const profileRepo = {
    findById: jest.fn((id: string) => Promise.resolve(profileStore.get(id) ?? null)),
  } as unknown as CuratedProfileRepository;
  const opens = new Map<string, { opens: number; lastOpenedAt: Date | null }>();
  const views = {
    countOpensByShareLink: jest.fn((ids: readonly string[]) =>
      Promise.resolve(
        ids.flatMap((id) => {
          const row = opens.get(id);
          return row ? [{ shareLinkId: id, ...row }] : [];
        }),
      ),
    ),
  } as unknown as ProfileViewRepository;
  const queue = [...codes];
  const generator = { generate: jest.fn(() => queue.shift() ?? `z${String(queue.length)}`) };
  return { profileRepo, links, views, generator, create, opens, store };
}

describe('CreateShareLinkUseCase', () => {
  it('crea un enlace MANUAL con portal normalizado y 0 aperturas', async () => {
    const b = build();
    const result = await new CreateShareLinkUseCase(
      b.profileRepo,
      b.links,
      b.views,
      b.generator,
    ).execute({ profileId: 'cp1', label: '  Acme — RR. HH.  ', portal: 'LinkedIn' });
    if (!result.ok) throw new Error('debía crear');
    expect(result.value).toMatchObject({
      code: 'aaaaaaaaaa',
      label: 'Acme — RR. HH.',
      portal: 'linkedin',
      kind: 'MANUAL',
      revokedAt: null,
      opens: 0,
      lastOpenedAt: null,
    });
  });

  it('colisión: reintenta con otro código y no hay error', async () => {
    const b = build([PROFILE], ['dupdupdupd', 'dupdupdupd', 'libre00000']);
    const useCase = new CreateShareLinkUseCase(b.profileRepo, b.links, b.views, b.generator);
    const first = await useCase.execute({ profileId: 'cp1', label: 'Uno' });
    const second = await useCase.execute({ profileId: 'cp1', label: 'Dos' });
    if (!first.ok || !second.ok) throw new Error('debía crear');
    expect(first.value.code).toBe('dupdupdupd');
    expect(second.value.code).toBe('libre00000');
    expect(b.generator.generate).toHaveBeenCalledTimes(3);
  });

  it('si los 3 intentos colisionan: ConflictError', async () => {
    const b = build([PROFILE], ['dupdupdupd']);
    b.generator.generate.mockReturnValue('dupdupdupd');
    const useCase = new CreateShareLinkUseCase(b.profileRepo, b.links, b.views, b.generator);
    await useCase.execute({ profileId: 'cp1', label: 'Uno' });
    const result = await useCase.execute({ profileId: 'cp1', label: 'Dos' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ConflictError);
    expect(b.create).toHaveBeenCalledTimes(1 + SHARE_CODE_ATTEMPTS);
  });

  it.each([
    ['etiqueta vacía', { label: '' }],
    ['etiqueta de 81', { label: 'x'.repeat(81) }],
    ['portal inválido', { label: 'Acme', portal: 'mi portal!' }],
  ])('%s: ValidationError y no crea nada', async (_name, input) => {
    const b = build();
    const result = await new CreateShareLinkUseCase(
      b.profileRepo,
      b.links,
      b.views,
      b.generator,
    ).execute({ profileId: 'cp1', ...input });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR');
    expect(b.create).not.toHaveBeenCalled();
  });

  it('perfil inexistente: NotFound', async () => {
    const b = build();
    const result = await new CreateShareLinkUseCase(
      b.profileRepo,
      b.links,
      b.views,
      b.generator,
    ).execute({ profileId: 'nope', label: 'Acme' });
    expect(result.ok).toBe(false);
    expect(b.create).not.toHaveBeenCalled();
  });
});

describe('ListShareLinksUseCase', () => {
  it('lista más recientes primero con sus aperturas', async () => {
    const b = build([PROFILE], ['aaaaaaaaaa', 'bbbbbbbbbb']);
    const create = new CreateShareLinkUseCase(b.profileRepo, b.links, b.views, b.generator);
    await create.execute({ profileId: 'cp1', label: 'Viejo' });
    await create.execute({ profileId: 'cp1', label: 'Nuevo' });
    b.opens.set('sl1', { opens: 3, lastOpenedAt: new Date('2026-10-20T00:00:00Z') });
    const result = await new ListShareLinksUseCase(b.profileRepo, b.links, b.views).execute({
      profileId: 'cp1',
    });
    if (!result.ok) throw new Error('debía listar');
    expect(result.value.map((l) => l.label)).toEqual(['Nuevo', 'Viejo']);
    expect(result.value[0]).toMatchObject({ opens: 0, lastOpenedAt: null });
    expect(result.value[1]).toMatchObject({ opens: 3, lastOpenedAt: '2026-10-20T00:00:00.000Z' });
  });

  it('perfil inexistente: NotFound', async () => {
    const b = build();
    const result = await new ListShareLinksUseCase(b.profileRepo, b.links, b.views).execute({
      profileId: 'nope',
    });
    expect(result.ok).toBe(false);
  });
});

describe('RenameShareLinkUseCase y RevokeShareLinkUseCase', () => {
  async function withLink() {
    const b = build([PROFILE, { ...PROFILE, id: 'cp2', slug: 'otro' }]);
    await new CreateShareLinkUseCase(b.profileRepo, b.links, b.views, b.generator).execute({
      profileId: 'cp1',
      label: 'Acme',
      portal: 'linkedin',
    });
    return b;
  }

  it('renombrar cambia la etiqueta y deja código, portal y perfil', async () => {
    const b = await withLink();
    const result = await new RenameShareLinkUseCase(b.profileRepo, b.links, b.views).execute({
      profileId: 'cp1',
      linkId: 'sl1',
      label: ' Globex ',
    });
    if (!result.ok) throw new Error('debía renombrar');
    expect(result.value).toMatchObject({ label: 'Globex', code: 'aaaaaaaaaa', portal: 'linkedin' });
  });

  it('renombrar con etiqueta vacía: ValidationError', async () => {
    const b = await withLink();
    const result = await new RenameShareLinkUseCase(b.profileRepo, b.links, b.views).execute({
      profileId: 'cp1',
      linkId: 'sl1',
      label: ' ',
    });
    expect(result.ok).toBe(false);
  });

  it('un enlace de otro perfil o inexistente es NotFound y no cambia', async () => {
    const b = await withLink();
    const rename = new RenameShareLinkUseCase(b.profileRepo, b.links, b.views);
    const revoke = new RevokeShareLinkUseCase(b.profileRepo, b.links, b.views, clock);
    expect((await rename.execute({ profileId: 'cp2', linkId: 'sl1', label: 'X' })).ok).toBe(false);
    expect((await revoke.execute({ profileId: 'cp2', linkId: 'sl1' })).ok).toBe(false);
    expect((await revoke.execute({ profileId: 'cp1', linkId: 'nope' })).ok).toBe(false);
    expect(b.store.get('sl1')?.isActive()).toBe(true);
    expect(b.store.get('sl1')?.label).toBe('Acme');
  });

  it('revocar fija la fecha una sola vez (idempotente) y no vuelve a escribir', async () => {
    const b = await withLink();
    let later = NOW;
    const moving: Clock = { now: () => (later = new Date(later.getTime() + 60_000)) };
    const revoke = new RevokeShareLinkUseCase(b.profileRepo, b.links, b.views, moving);
    const first = await revoke.execute({ profileId: 'cp1', linkId: 'sl1' });
    const second = await revoke.execute({ profileId: 'cp1', linkId: 'sl1' });
    if (!first.ok || !second.ok) throw new Error('debía revocar');
    expect(first.value.revokedAt).toBe(new Date(NOW.getTime() + 60_000).toISOString());
    expect(second.value.revokedAt).toBe(first.value.revokedAt);
    expect(b.links.save).toHaveBeenCalledTimes(1);
  });
});

describe('GetOrCreateLinkedInShareLinkUseCase', () => {
  const build2 = (
    over: Partial<CuratedProfileProps> = {},
    codes = ['aaaaaaaaaa', 'bbbbbbbbbb'],
  ) => {
    const b = build([{ ...PROFILE, ...over }], codes);
    return {
      ...b,
      useCase: new GetOrCreateLinkedInShareLinkUseCase(
        b.profileRepo,
        b.links,
        b.views,
        b.generator,
      ),
    };
  };

  it('crea uno con portal linkedin y lo reusa mientras esté activo', async () => {
    const b = build2();
    const first = await b.useCase.execute({ profileId: 'cp1' });
    const second = await b.useCase.execute({ profileId: 'cp1' });
    if (!first.ok || !second.ok) throw new Error('debía responder');
    expect(first.value.created).toBe(true);
    expect(first.value.link).toMatchObject({
      kind: 'LINKEDIN_POST',
      portal: 'linkedin',
      label: LINKEDIN_LABEL,
    });
    expect(second.value.created).toBe(false);
    expect(second.value.link.code).toBe(first.value.link.code);
  });

  it('revocado, el siguiente pedido crea otro con otro código', async () => {
    const b = build2();
    const first = await b.useCase.execute({ profileId: 'cp1' });
    await new RevokeShareLinkUseCase(b.profileRepo, b.links, b.views, clock).execute({
      profileId: 'cp1',
      linkId: 'sl1',
    });
    const again = await b.useCase.execute({ profileId: 'cp1' });
    if (!first.ok || !again.ok) throw new Error('debía responder');
    expect(again.value.created).toBe(true);
    expect(again.value.link.code).not.toBe(first.value.link.code);
  });

  it.each([
    ['PROTECTED', { visibility: 'PROTECTED' as const, accessToken: AccessToken.create('t') }],
    ['PRIVATE', { visibility: 'PRIVATE' as const }],
    ['archivado', { archivedAt: new Date('2026-10-01T00:00:00Z') }],
  ])('perfil %s: ConflictError y no crea nada', async (_name, over) => {
    const b = build2(over);
    const result = await b.useCase.execute({ profileId: 'cp1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ConflictError);
    expect(b.create).not.toHaveBeenCalled();
  });

  it('perfil inexistente: NotFound', async () => {
    const b = build2();
    expect((await b.useCase.execute({ profileId: 'nope' })).ok).toBe(false);
  });
});
