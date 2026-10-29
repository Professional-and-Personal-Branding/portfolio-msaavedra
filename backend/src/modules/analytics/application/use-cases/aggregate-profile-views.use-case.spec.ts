import { ProfileViewRepository } from '../../domain/repositories/profile-view.repository';
import { AggregateProfileViewsUseCase } from './aggregate-profile-views.use-case';

const EMPTY = { total: 0, byProfile: [], byLocale: [], byDay: [] };

describe('AggregateProfileViewsUseCase', () => {
  const repo: ProfileViewRepository = {
    record: jest.fn(),
    aggregate: jest.fn().mockResolvedValue({ ...EMPTY, total: 3 }),
    countByKind: jest.fn().mockResolvedValue([]),
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
});
