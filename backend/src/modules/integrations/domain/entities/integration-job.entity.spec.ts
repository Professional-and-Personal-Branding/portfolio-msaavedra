import {
  IntegrationJob,
  IntegrationJobProps,
  IntegrationJobStatus,
  JOB_TRANSITIONS,
} from './integration-job.entity';

const NOW = new Date('2026-11-12T12:00:00.000Z');

function job(patch: Partial<IntegrationJobProps> = {}): IntegrationJob {
  return new IntegrationJob({
    id: 'j1',
    provider: 'fake',
    kind: 'sync',
    idempotencyKey: 'sync:fake:daily:2026-11-12',
    payload: {},
    status: 'RUNNING',
    attempts: 1,
    maxAttempts: 8,
    runAt: NOW,
    lockedBy: 'h1',
    lockedUntil: new Date(NOW.getTime() + 60_000),
    lastErrorClass: null,
    lastError: null,
    createdAt: NOW,
    updatedAt: NOW,
    finishedAt: null,
    ...patch,
  });
}

const STATUSES: IntegrationJobStatus[] = ['PENDING', 'RUNNING', 'DONE', 'FAILED', 'DEAD'];

describe('IntegrationJob', () => {
  describe('tabla de transiciones', () => {
    it('declara exactamente las transiciones de D7', () => {
      expect(JOB_TRANSITIONS).toEqual({
        PENDING: ['RUNNING'],
        FAILED: ['RUNNING'],
        RUNNING: ['DONE', 'FAILED', 'DEAD', 'PENDING'],
        DONE: [],
        DEAD: [],
      });
    });

    it.each(STATUSES.filter((s) => s !== 'RUNNING'))(
      'complete, fail, release y expireLock desde %s están prohibidos',
      (status) => {
        const j = job({ status, lockedUntil: new Date(NOW.getTime() - 1000) });
        expect(j.complete(NOW).ok).toBe(false);
        expect(j.fail({ kind: 'Transient', message: 'x' }, NOW).ok).toBe(false);
        expect(j.fail({ kind: 'Permanent', message: 'x' }, NOW).ok).toBe(false);
        expect(j.release(NOW).ok).toBe(false);
        expect(j.expireLock(NOW).ok).toBe(false);
      },
    );

    it.each(['DONE', 'DEAD', 'RUNNING'] as const)('claim desde %s está prohibido', (status) => {
      expect(job({ status }).claim('h', NOW, 1000).ok).toBe(false);
    });
  });

  describe('claim', () => {
    it.each(['PENDING', 'FAILED'] as const)(
      '%s → RUNNING cuenta el intento y toma el lock',
      (status) => {
        const result = job({ status, attempts: 2, lockedBy: null, lockedUntil: null }).claim(
          'holder',
          NOW,
          90_000,
        );
        if (!result.ok) throw new Error('se esperaba ok');
        expect(result.value.props).toMatchObject({
          status: 'RUNNING',
          attempts: 3,
          lockedBy: 'holder',
          lockedUntil: new Date(NOW.getTime() + 90_000),
        });
      },
    );
  });

  describe('complete', () => {
    it('RUNNING → DONE limpia el lock y el error', () => {
      const result = job({ lastError: 'viejo', lastErrorClass: 'Transient' }).complete(NOW);
      if (!result.ok) throw new Error('se esperaba ok');
      expect(result.value.props).toMatchObject({
        status: 'DONE',
        lockedBy: null,
        lockedUntil: null,
        lastError: null,
        finishedAt: NOW,
      });
    });
  });

  describe('fail', () => {
    it('Transient con intentos disponibles → FAILED con runAt por D8', () => {
      const result = job({ attempts: 1 }).fail({ kind: 'Transient', message: 'x' }, NOW, () => 0.5);
      if (!result.ok) throw new Error('se esperaba ok');
      expect(result.value.props.status).toBe('FAILED');
      expect(result.value.props.runAt).toEqual(new Date(NOW.getTime() + 15_000));
      expect(result.value.props.lastErrorClass).toBe('Transient');
      expect(result.value.props.lockedBy).toBeNull();
    });

    it('RetryAfter → FAILED con runAt = ahora + pista + margen', () => {
      const result = job().fail({ kind: 'RetryAfter', seconds: 60, message: 'x' }, NOW, () => 0);
      if (!result.ok) throw new Error('se esperaba ok');
      expect(result.value.props.status).toBe('FAILED');
      expect(result.value.props.runAt).toEqual(new Date(NOW.getTime() + 61_000));
    });

    it('ResetAt → FAILED con runAt = la fecha + margen', () => {
      const at = new Date(NOW.getTime() + 3_600_000);
      const result = job().fail({ kind: 'ResetAt', at, message: 'x' }, NOW, () => 0);
      if (!result.ok) throw new Error('se esperaba ok');
      expect(result.value.props.runAt).toEqual(new Date(at.getTime() + 1000));
    });

    it.each([
      { kind: 'Permanent', message: 'x' },
      { kind: 'BudgetExhausted', message: 'x' },
    ] as const)('%j → DEAD', (failure) => {
      const result = job().fail(failure, NOW);
      if (!result.ok) throw new Error('se esperaba ok');
      expect(result.value.props.status).toBe('DEAD');
      expect(result.value.props.finishedAt).toEqual(NOW);
    });

    it('intentos agotados → DEAD aunque el fallo sea reintentable', () => {
      const result = job({ attempts: 8, maxAttempts: 8 }).fail(
        { kind: 'Transient', message: 'x' },
        NOW,
      );
      if (!result.ok) throw new Error('se esperaba ok');
      expect(result.value.props.status).toBe('DEAD');
    });
  });

  describe('release', () => {
    it('RUNNING → PENDING con runAt = ahora y sin consumir el intento', () => {
      const result = job({ attempts: 3 }).release(NOW);
      if (!result.ok) throw new Error('se esperaba ok');
      expect(result.value.props).toMatchObject({
        status: 'PENDING',
        attempts: 2,
        runAt: NOW,
        lockedBy: null,
        lockedUntil: null,
      });
    });

    it('no baja de cero', () => {
      const result = job({ attempts: 0 }).release(NOW);
      if (!result.ok) throw new Error('se esperaba ok');
      expect(result.value.props.attempts).toBe(0);
    });
  });

  describe('expireLock', () => {
    const expired = new Date(NOW.getTime() - 1000);

    it('lock vencido → FAILED con «lock vencido»', () => {
      const result = job({ lockedUntil: expired, attempts: 2 }).expireLock(NOW, () => 0.5);
      if (!result.ok) throw new Error('se esperaba ok');
      expect(result.value.props).toMatchObject({
        status: 'FAILED',
        lastErrorClass: 'Transient',
        lastError: 'lock vencido',
      });
      expect(result.value.props.runAt.getTime()).toBeGreaterThan(NOW.getTime());
    });

    it('lock vencido con 8/8 intentos → DEAD', () => {
      const result = job({ lockedUntil: expired, attempts: 8 }).expireLock(NOW);
      if (!result.ok) throw new Error('se esperaba ok');
      expect(result.value.props.status).toBe('DEAD');
    });

    it('un lock vigente no se puede expirar', () => {
      expect(job().expireLock(NOW).ok).toBe(false);
    });
  });
});
