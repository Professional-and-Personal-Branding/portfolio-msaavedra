import { AiRun, AiRunFinalStatus, AiRunIdentity } from './ai-run.entity';

const NOW = new Date('2026-11-17T12:00:00Z');
const identity: AiRunIdentity = {
  id: 'run1',
  task: 'ai.smoke',
  promptVersion: 1,
  model: 'claude-haiku-5-5',
  inputHash: 'h',
  cacheKey: 'k',
  budgetMonth: '2026-11',
  now: NOW,
};
const finish = (status: AiRunFinalStatus) => ({
  status,
  costMicroUsd: 10,
  durationMs: 5,
  finishedAt: NOW,
});

describe('AiRun', () => {
  const reserved = () => AiRun.reserved(identity, 500, new Date('2026-11-17T12:02:00Z'));

  it.each<AiRunFinalStatus>(['SUCCEEDED', 'REFUSED', 'FAILED', 'ABANDONED'])(
    'RESERVED → %s es válida y conserva la identidad',
    (status) => {
      const result = reserved().finish(finish(status));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe(status);
        expect(result.value.props.costMicroUsd).toBe(10);
        expect(result.value.props.reservedMicroUsd).toBe(500);
        expect(result.value.id).toBe('run1');
      }
    },
  );

  it('nace RESERVED con su vencimiento y sin costo', () => {
    const run = reserved();
    expect(run.status).toBe('RESERVED');
    expect(run.props.costMicroUsd).toBeNull();
    expect(run.props.reservationExpiresAt).toEqual(new Date('2026-11-17T12:02:00Z'));
  });

  it('CACHED y BLOCKED nacen terminales con costo 0', () => {
    const cached = AiRun.cached(identity, { estado: 'ok' });
    const blocked = AiRun.blocked(identity, 'ForbiddenData', 'x');
    expect(cached.status).toBe('CACHED');
    expect(cached.props.costMicroUsd).toBe(0);
    expect(cached.props.output).toEqual({ estado: 'ok' });
    expect(blocked.status).toBe('BLOCKED');
    expect(blocked.props.costMicroUsd).toBe(0);
    expect(blocked.props.finishedAt).toEqual(NOW);
  });

  it.each([
    ['CACHED', AiRun.cached(identity, null)],
    ['BLOCKED', AiRun.blocked(identity, 'k', 'm')],
    ['FAILED', AiRun.failedBeforeReserve(identity, 'Transient', 'm', 1)],
  ])('una corrida %s no admite más transiciones', (_name, run) => {
    const result = run.finish(finish('SUCCEEDED'));
    expect(result.ok).toBe(false);
  });

  it('una corrida ya cerrada tampoco se vuelve a cerrar', () => {
    const closed = reserved().finish(finish('FAILED'));
    if (!closed.ok) throw new Error('se esperaba ok');
    expect(closed.value.finish(finish('SUCCEEDED')).ok).toBe(false);
  });
});
