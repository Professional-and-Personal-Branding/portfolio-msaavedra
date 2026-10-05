import { Clock } from '../../../../../shared/domain/clock';
import {
  CuratedProfile,
  CuratedProfileProps,
  NewCuratedProfileProps,
} from '../../../domain/entities/curated-profile.entity';
import { CuratedProfileRepository } from '../../../domain/repositories/curated-profile.repository';
import { AccessToken } from '../../../domain/value-objects/access-token.vo';
import {
  ArchiveCuratedProfileUseCase,
  DuplicateCuratedProfileUseCase,
  MAX_DUPLICATE_SUFFIX,
  UnarchiveCuratedProfileUseCase,
} from './curated-profile-lifecycle.use-cases';

const ORIGINAL: CuratedProfileProps = {
  id: 'cp1',
  slug: 'acme-lead',
  title: { es: 'Acme Lead' },
  headline: { es: 'Titular' },
  description: { es: 'Desc' },
  roleType: { es: 'Tech Lead' },
  techFocus: '.NET',
  filterTags: ['dotnet', 'leadership'],
  includeIds: ['exp-a'],
  excludeIds: ['exp-b'],
  accentColor: '#5B2C87',
  themeId: 't1',
  themeOverrides: { colors: { accent: '#ffffff' } },
  layout: 'sidebar',
  sectionsOrder: ['hero', 'experience', 'skills'],
  sectionsHidden: ['stats'],
  visibility: 'PUBLIC',
  accessToken: AccessToken.create('secreto'),
  views: 40,
};

/** Repositorio en memoria: lo justo para observar lo que hacen los casos de uso. */
function build(profiles: CuratedProfileProps[] = [ORIGINAL], takenSlugs: string[] = []) {
  const store = new Map(profiles.map((p) => [p.id, CuratedProfile.create(p)]));
  const created: NewCuratedProfileProps[] = [];
  const repo = {
    findById: jest.fn((id: string) => Promise.resolve(store.get(id) ?? null)),
    existsBySlug: jest.fn((slug: string) =>
      Promise.resolve(
        takenSlugs.includes(slug) || [...store.values()].some((p) => p.slug === slug),
      ),
    ),
    create: jest.fn((props: NewCuratedProfileProps) => {
      created.push(props);
      const cp = CuratedProfile.create({ ...props, id: `new-${created.length}`, views: 0 });
      store.set(cp.id, cp);
      return Promise.resolve(cp);
    }),
    update: jest.fn((cp: CuratedProfile) => {
      store.set(cp.id, cp);
      return Promise.resolve(cp);
    }),
  } as unknown as CuratedProfileRepository;
  return { repo, store, created };
}

describe('DuplicateCuratedProfileUseCase', () => {
  it('copia la configuración: tags, overrides, secciones, tema y layout idénticos', async () => {
    const { repo } = build();
    const result = await new DuplicateCuratedProfileUseCase(repo).execute({ id: 'cp1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dup = result.value;
    expect(dup.filterTags).toEqual(ORIGINAL.filterTags);
    expect(dup.includeIds).toEqual(ORIGINAL.includeIds);
    expect(dup.excludeIds).toEqual(ORIGINAL.excludeIds);
    expect(dup.sectionsOrder).toEqual(ORIGINAL.sectionsOrder);
    expect(dup.sectionsHidden).toEqual(ORIGINAL.sectionsHidden);
    expect(dup.themeOverrides).toEqual(ORIGINAL.themeOverrides);
    expect(dup.themeId).toBe('t1');
    expect(dup.layout).toBe('sidebar');
    expect(dup.title).toEqual(ORIGINAL.title);
  });

  it('el duplicado nace retirado: PRIVATE, no enumerado, sin token, sin visitas ni archivado', async () => {
    const { repo } = build([{ ...ORIGINAL, archivedAt: new Date('2026-10-01') }]);
    const result = await new DuplicateCuratedProfileUseCase(repo).execute({ id: 'cp1' });
    if (!result.ok) throw new Error('debía duplicar');
    expect(result.value).toMatchObject({
      visibility: 'PRIVATE',
      listed: false,
      accessToken: null,
      views: 0,
      archivedAt: null,
    });
  });

  it('slug derivado: el primer sufijo libre', async () => {
    const { repo } = build(undefined, ['acme-lead-2']);
    const result = await new DuplicateCuratedProfileUseCase(repo).execute({ id: 'cp1' });
    if (!result.ok) throw new Error('debía duplicar');
    expect(result.value.slug).toBe('acme-lead-3');
  });

  it('el original no se modifica', async () => {
    const { repo, store } = build();
    await new DuplicateCuratedProfileUseCase(repo).execute({ id: 'cp1' });
    const original = store.get('cp1')!;
    expect(original.slug).toBe('acme-lead');
    expect(original.visibility).toBe('PUBLIC');
    expect(original.accessToken.value).toBe('secreto');
    expect(original.views).toBe(40);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('id inexistente → not found', async () => {
    const { repo } = build();
    const result = await new DuplicateCuratedProfileUseCase(repo).execute({ id: 'no' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.name).toBe('CuratedProfileNotFoundError');
  });

  it(`sin sufijo libre hasta -${MAX_DUPLICATE_SUFFIX} → conflicto, sin iterar más`, async () => {
    const taken = Array.from({ length: MAX_DUPLICATE_SUFFIX - 1 }, (_, i) => `acme-lead-${i + 2}`);
    const { repo } = build(undefined, taken);
    const result = await new DuplicateCuratedProfileUseCase(repo).execute({ id: 'cp1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.name).toBe('ConflictError');
    expect(repo.existsBySlug).toHaveBeenCalledTimes(MAX_DUPLICATE_SUFFIX - 1);
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe('Archivar y desarchivar', () => {
  const PRIMERA = new Date('2026-10-05T10:00:00Z');
  const SEGUNDA = new Date('2026-10-06T10:00:00Z');
  const clockAt = (...dates: Date[]): Clock => {
    let i = 0;
    return { now: () => dates[Math.min(i++, dates.length - 1)] };
  };

  it('archivar registra la hora del reloj inyectado', async () => {
    const { repo } = build();
    const result = await new ArchiveCuratedProfileUseCase(repo, clockAt(PRIMERA)).execute({
      id: 'cp1',
    });
    if (!result.ok) throw new Error('debía archivar');
    expect(result.value.archivedAt).toBe(PRIMERA.toISOString());
  });

  it('archivar dos veces es idempotente y conserva la primera fecha', async () => {
    const { repo } = build();
    const archive = new ArchiveCuratedProfileUseCase(repo, clockAt(PRIMERA, SEGUNDA));
    await archive.execute({ id: 'cp1' });
    const again = await archive.execute({ id: 'cp1' });
    if (!again.ok) throw new Error('debía responder ok');
    expect(again.value.archivedAt).toBe(PRIMERA.toISOString());
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  it('archivar no toca visitas, visibilidad ni enumeración', async () => {
    const { repo, store } = build();
    await new ArchiveCuratedProfileUseCase(repo, clockAt(PRIMERA)).execute({ id: 'cp1' });
    const cp = store.get('cp1')!;
    expect(cp.views).toBe(40);
    expect(cp.visibility).toBe('PUBLIC');
    expect(cp.listed).toBe(true);
  });

  it('desarchivar deja archivedAt nulo; sobre uno vivo no hace nada', async () => {
    const { repo } = build([{ ...ORIGINAL, archivedAt: PRIMERA }]);
    const unarchive = new UnarchiveCuratedProfileUseCase(repo);
    const result = await unarchive.execute({ id: 'cp1' });
    if (!result.ok) throw new Error('debía desarchivar');
    expect(result.value.archivedAt).toBeNull();
    await unarchive.execute({ id: 'cp1' });
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  it('id inexistente → not found en los dos', async () => {
    const { repo } = build();
    expect(
      (await new ArchiveCuratedProfileUseCase(repo, clockAt(PRIMERA)).execute({ id: 'x' })).ok,
    ).toBe(false);
    expect((await new UnarchiveCuratedProfileUseCase(repo).execute({ id: 'x' })).ok).toBe(false);
  });
});
