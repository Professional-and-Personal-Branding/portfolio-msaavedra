import { ProfileViewRepository } from '../../domain/repositories/profile-view.repository';
import { AggregateProfileViewsUseCase } from './aggregate-profile-views.use-case';

const EMPTY = { total: 0, byProfile: [], byLocale: [], byDay: [] };

describe('AggregateProfileViewsUseCase', () => {
  let repo: ProfileViewRepository;

  beforeEach(() => {
    repo = {
      record: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ ...EMPTY, total: 3 }),
    };
  });

  it('rango por defecto: los 30 días UTC completos que terminan hoy', async () => {
    const now = new Date('2026-09-07T12:00:00Z');
    const result = await new AggregateProfileViewsUseCase(repo).execute({ now });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.from).toBe('2026-08-09T00:00:00.000Z');
    expect(result.value.to).toBe('2026-09-07T23:59:59.999Z');
    expect(result.value.total).toBe(3);
    expect(repo.aggregate).toHaveBeenCalledWith({
      from: new Date('2026-08-09T00:00:00Z'),
      to: new Date('2026-09-08T00:00:00Z'),
    });
  });

  it('un rango que termina hoy incluye una visita de ahora (D-01)', async () => {
    const now = new Date('2026-10-05T18:00:00Z');
    const today = new Date('2026-10-05');
    await new AggregateProfileViewsUseCase(repo).execute({ from: today, to: today, now });
    const [range] = jest.mocked(repo.aggregate).mock.calls[0];
    expect(range.from.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(range.to.getTime()).toBeGreaterThan(now.getTime());
  });

  it('normaliza a días UTC completos: from al inicio, to al final (inclusivo)', async () => {
    const result = await new AggregateProfileViewsUseCase(repo).execute({
      from: new Date('2026-10-01T15:30:00Z'),
      to: new Date('2026-10-05T03:00:00Z'),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.from).toBe('2026-10-01T00:00:00.000Z');
    expect(result.value.to).toBe('2026-10-05T23:59:59.999Z');
    expect(repo.aggregate).toHaveBeenCalledWith({
      from: new Date('2026-10-01T00:00:00Z'),
      to: new Date('2026-10-06T00:00:00Z'),
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
