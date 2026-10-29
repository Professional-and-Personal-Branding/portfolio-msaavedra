import { ProfileViewRepository } from '../../domain/repositories/profile-view.repository';
import { AggregateProfileViewsUseCase } from './aggregate-profile-views.use-case';

const EMPTY = { total: 0, byProfile: [], byLocale: [], byDay: [] };

describe('AggregateProfileViewsUseCase', () => {
  const repo: ProfileViewRepository = {
    record: jest.fn(),
    aggregate: jest.fn().mockResolvedValue({ ...EMPTY, total: 3 }),
    countByKind: jest.fn().mockResolvedValue([]),
    countByShareLink: jest.fn().mockResolvedValue([]),
    countBySource: jest.fn().mockResolvedValue([]),
    countOpensByShareLink: jest.fn().mockResolvedValue([]),
    countByReferrer: jest.fn().mockResolvedValue([
      { referrer: 'https://www.linkedin.com/feed/', views: 2 },
      { referrer: null, views: 1 },
    ]),
  };

  it('rango por defecto: últimos 30 días hasta ahora', async () => {
    const now = new Date('2026-09-07T12:00:00Z');
    const result = await new AggregateProfileViewsUseCase(repo).execute({ now });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.to).toBe('2026-09-07T12:00:00.000Z');
    expect(result.value.from).toBe('2026-08-08T12:00:00.000Z');
    expect(result.value.total).toBe(3);
    expect(repo.aggregate).toHaveBeenCalledWith({
      from: new Date('2026-08-08T12:00:00Z'),
      to: now,
    });
  });

  it('rango explícito y rango invertido → ValidationError', async () => {
    const from = new Date('2026-01-01');
    const to = new Date('2026-02-01');
    const ok = await new AggregateProfileViewsUseCase(repo).execute({ from, to });
    expect(ok.ok).toBe(true);
    const bad = await new AggregateProfileViewsUseCase(repo).execute({ from: to, to: from });
    expect(bad.ok).toBe(false);
  });

  it('byReferrer normaliza el origen y suma lo mismo que total', async () => {
    const result = await new AggregateProfileViewsUseCase(repo).execute({
      siteUrl: 'https://manuel.dev',
    });
    if (!result.ok) throw new Error('debía agregar');
    expect(result.value.byReferrer).toEqual([
      { referrer: 'linkedin.com', views: 2 },
      { referrer: 'directo', views: 1 },
    ]);
    const sum = result.value.byReferrer.reduce((acc, r) => acc + r.views, 0);
    expect(sum).toBe(result.value.total);
  });

  describe('byKind', () => {
    const withKinds = (rows: { kind: 'HUMAN' | 'OWNER' | 'BOT'; views: number }[]) =>
      ({
        ...repo,
        aggregate: jest.fn().mockResolvedValue({ ...EMPTY }),
        countByKind: jest.fn().mockResolvedValue(rows),
      }) satisfies ProfileViewRepository;

    it('rango vacío: los tres tipos en cero y en orden fijo', async () => {
      const result = await new AggregateProfileViewsUseCase(withKinds([])).execute({});
      if (!result.ok) throw new Error('debía agregar');
      expect(result.value.byKind).toEqual([
        { kind: 'HUMAN', views: 0 },
        { kind: 'OWNER', views: 0 },
        { kind: 'BOT', views: 0 },
      ]);
    });

    it('solo BOT: el total sigue siendo el de personas y byKind trae el BOT', async () => {
      const result = await new AggregateProfileViewsUseCase(
        withKinds([{ kind: 'BOT', views: 4 }]),
      ).execute({});
      if (!result.ok) throw new Error('debía agregar');
      expect(result.value.total).toBe(0);
      expect(result.value.byKind).toEqual([
        { kind: 'HUMAN', views: 0 },
        { kind: 'OWNER', views: 0 },
        { kind: 'BOT', views: 4 },
      ]);
    });

    it('el orden es fijo aunque el repositorio devuelva otro', async () => {
      const result = await new AggregateProfileViewsUseCase(
        withKinds([
          { kind: 'BOT', views: 1 },
          { kind: 'OWNER', views: 3 },
          { kind: 'HUMAN', views: 12 },
        ]),
      ).execute({});
      if (!result.ok) throw new Error('debía agregar');
      expect(result.value.byKind.map((k) => k.kind)).toEqual(['HUMAN', 'OWNER', 'BOT']);
      expect(result.value.byKind.map((k) => k.views)).toEqual([12, 3, 1]);
    });
  });

  describe('byShareLink y bySource (add-share-links)', () => {
    const LINKS = [
      {
        shareLinkId: 'a',
        code: 'k7m2q9xw4t',
        label: 'Acme',
        slug: 'tech-lead-dotnet',
        portal: 'linkedin',
        revoked: false,
        views: 3,
      },
      {
        shareLinkId: 'b',
        code: 'n3p5r7s9v1',
        label: 'Globex',
        slug: 'tech-lead-dotnet',
        portal: null,
        revoked: true,
        views: 1,
      },
    ];
    const SOURCES = [
      { source: 'linkedin', views: 3 },
      { source: 'indeed', views: 2 },
    ];
    const withAttribution = (links: typeof LINKS, sources: typeof SOURCES) =>
      ({
        ...repo,
        aggregate: jest.fn().mockResolvedValue({ ...EMPTY, total: 6 }),
        countByShareLink: jest.fn().mockResolvedValue(links),
        countBySource: jest.fn().mockResolvedValue(sources),
      }) satisfies ProfileViewRepository;

    it('devuelve lo que el repositorio ordenó, con el mismo rango, y no toca byReferrer', async () => {
      const source = withAttribution(LINKS, SOURCES);
      const result = await new AggregateProfileViewsUseCase(source).execute({});
      if (!result.ok) throw new Error('debía agregar');
      expect(result.value.byShareLink).toEqual(LINKS);
      expect(result.value.bySource).toEqual(SOURCES);
      expect(result.value.byReferrer.map((r) => r.referrer)).toEqual(['linkedin.com', 'directo']);
      const [range] = source.countByShareLink.mock.calls[0] as [{ from: Date; to: Date }];
      expect(range.from).toBeInstanceOf(Date);
      expect(range.to.getTime() - range.from.getTime()).toBe(30 * 86_400_000);
    });

    it('sin atribuciones: listas vacías, no ceros', async () => {
      const result = await new AggregateProfileViewsUseCase(withAttribution([], [])).execute({});
      if (!result.ok) throw new Error('debía agregar');
      expect(result.value.byShareLink).toEqual([]);
      expect(result.value.bySource).toEqual([]);
    });
  });
});
