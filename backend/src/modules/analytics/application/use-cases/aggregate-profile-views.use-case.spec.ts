import { ProfileViewRepository } from '../../domain/repositories/profile-view.repository';
import { AggregateProfileViewsUseCase } from './aggregate-profile-views.use-case';

const EMPTY = { total: 0, byProfile: [], byLocale: [], byDay: [] };

describe('AggregateProfileViewsUseCase', () => {
  const repo: ProfileViewRepository = {
    record: jest.fn(),
    aggregate: jest.fn().mockResolvedValue({ ...EMPTY, total: 3 }),
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
});
