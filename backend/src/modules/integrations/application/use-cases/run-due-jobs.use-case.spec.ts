import { fail, ok } from '../../../../shared/domain/result';
import {
  CapturingLoggerFactory,
  FakeClock,
  FakeCredentialResolver,
  InMemoryJobRepository,
  InMemoryLease,
  InMemorySettingRepository,
  InMemorySyncRunRepository,
  makeJob,
  ScriptedConnector,
  StaticRegistry,
} from '../../../../../test/support/integrations-doubles';
import { CredentialUnreadableError } from '../../domain/errors/integration.errors';
import { SnapshotStore } from '../ports/snapshot-store.port';
import { RunDueJobsUseCase } from './run-due-jobs.use-case';

const NOW = new Date('2026-11-12T12:00:00.000Z');
const SECRET = 'secreto-de-prueba-123';

interface Options {
  jobTimeoutMs?: number;
  runMaxMs?: number;
  yieldTurn?: jest.Mock;
  holder?: string;
}

function setup(connector: ScriptedConnector, options: Options = {}) {
  const clock = new FakeClock(NOW);
  const jobs = new InMemoryJobRepository(clock);
  const settings = new InMemorySettingRepository(clock);
  const syncRuns = new InMemorySyncRunRepository();
  const lease = new InMemoryLease();
  const credentials = new FakeCredentialResolver();
  const loggers = new CapturingLoggerFactory();
  const yieldTurn = options.yieldTurn ?? jest.fn(async () => undefined);
  const snapshots = {} as SnapshotStore;
  const useCase = new RunDueJobsUseCase(
    lease,
    jobs,
    settings,
    syncRuns,
    new StaticRegistry([connector]),
    credentials,
    snapshots,
    loggers,
    clock,
    yieldTurn,
    {
      enabledProviders: ['fake'],
      schedulerEnabled: true,
      jobTimeoutMs: options.jobTimeoutMs ?? 5000,
      runMaxMs: options.runMaxMs ?? 300_000,
    },
    options.holder ?? 'holder-1',
    () => 0.5,
  );
  return { useCase, clock, jobs, settings, syncRuns, lease, credentials, loggers, yieldTurn };
}

const okConnector = () => new ScriptedConnector('fake', async () => ok({ itemsChanged: 2 }));

describe('RunDueJobsUseCase', () => {
  it('sin arriendo no reclama ningún trabajo', async () => {
    const { useCase, jobs, lease } = setup(okConnector());
    jobs.add(makeJob());
    lease.refuse = true;
    const summary = await useCase.execute();
    expect(summary.leased).toBe(false);
    expect(jobs.jobs.get('job-1')?.status).toBe('PENDING');
  });

  it('un trabajo exitoso queda DONE, con su SyncRun y el éxito en el proveedor', async () => {
    const connector = okConnector();
    const { useCase, jobs, syncRuns, settings } = setup(connector);
    jobs.add(makeJob());
    const summary = await useCase.execute();
    expect(summary).toMatchObject({ leased: true, processed: 1, done: 1 });
    expect(jobs.jobs.get('job-1')).toMatchObject({ status: 'DONE' });
    expect(syncRuns.runs).toHaveLength(1);
    expect(syncRuns.runs[0]).toMatchObject({ outcome: 'SUCCESS', itemsChanged: 2 });
    expect(settings.rows.get('fake')?.props.lastSuccessAt).toEqual(NOW);
  });

  it('recupera los locks vencidos antes de reclamar', async () => {
    const { useCase, jobs, clock } = setup(okConnector());
    jobs.add(
      makeJob({
        id: 'viejo',
        status: 'RUNNING',
        attempts: 1,
        lockedBy: 'otro',
        lockedUntil: new Date(NOW.getTime() - 1000),
      }),
    );
    await useCase.execute();
    expect(jobs.jobs.get('viejo')).toMatchObject({ status: 'FAILED' });
    expect(jobs.jobs.get('viejo')?.props.lastError).toBe('lock vencido');
    clock.advance(0);
  });

  it('renueva el arriendo antes de cada trabajo y corta si la renovación falla', async () => {
    const connector = okConnector();
    const { useCase, jobs, lease } = setup(connector);
    jobs.add(makeJob({ id: 'a', idempotencyKey: 'a' }));
    jobs.add(makeJob({ id: 'b', idempotencyKey: 'b' }));
    // 1 = toma inicial, 2 = renovación del primer reclamo; la del segundo falla.
    lease.failAfter = 2;
    const summary = await useCase.execute();
    expect(summary.processed).toBe(1);
    expect(connector.calls).toBe(1);
    expect(lease.holder).toBeNull();
  });

  it('procesa de a uno y cede el turno una vez entre dos trabajos', async () => {
    let running = 0;
    let maxRunning = 0;
    const connector = new ScriptedConnector('fake', async () => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setImmediate(r));
      running -= 1;
      return ok({ itemsChanged: 0 });
    });
    const { useCase, jobs, yieldTurn } = setup(connector);
    jobs.add(makeJob({ id: 'a', idempotencyKey: 'a' }));
    jobs.add(makeJob({ id: 'b', idempotencyKey: 'b' }));
    const summary = await useCase.execute();
    expect(summary.processed).toBe(2);
    expect(maxRunning).toBe(1);
    expect(yieldTurn).toHaveBeenCalledTimes(1);
  });

  it('corta por INTEGRATIONS_RUN_MAX_MS: vencida la duración no reclama otro', async () => {
    const clockHolder: { advance?: (ms: number) => void } = {};
    const connector = new ScriptedConnector('fake', async () => {
      clockHolder.advance?.(20_000);
      return ok({ itemsChanged: 0 });
    });
    const { useCase, jobs, clock } = setup(connector, { runMaxMs: 10_000 });
    clockHolder.advance = (ms) => clock.advance(ms);
    jobs.add(makeJob({ id: 'a', idempotencyKey: 'a' }));
    jobs.add(makeJob({ id: 'b', idempotencyKey: 'b' }));
    const summary = await useCase.execute();
    expect(summary.processed).toBe(1);
    expect(jobs.jobs.get('b')?.status).toBe('PENDING');
  });

  it('corta a los 20 trabajos por corrida', async () => {
    const { useCase, jobs } = setup(okConnector());
    for (let i = 0; i < 25; i++) jobs.add(makeJob({ id: `j${i}`, idempotencyKey: `k${i}` }));
    const summary = await useCase.execute();
    expect(summary.processed).toBe(20);
  });

  describe('clases de fallo (D9)', () => {
    it('Transient: FAILED con runAt futuro y sin pausa hasta el 5.º', async () => {
      const connector = new ScriptedConnector('fake', async () =>
        fail({ kind: 'Transient', message: 'caído' }),
      );
      const { useCase, jobs, settings, syncRuns } = setup(connector);
      jobs.add(makeJob());
      await useCase.execute();
      const job = jobs.jobs.get('job-1');
      expect(job?.status).toBe('FAILED');
      expect(job?.props.runAt.getTime()).toBeGreaterThan(NOW.getTime());
      expect(settings.rows.get('fake')?.props.consecutiveFailures).toBe(1);
      expect(syncRuns.runs[0].outcome).toBe('FAILED');
    });

    it('Permanent: DEAD', async () => {
      const connector = new ScriptedConnector('fake', async () =>
        fail({ kind: 'Permanent', message: 'no' }),
      );
      const { useCase, jobs, syncRuns } = setup(connector);
      jobs.add(makeJob());
      const summary = await useCase.execute();
      expect(jobs.jobs.get('job-1')?.status).toBe('DEAD');
      expect(syncRuns.runs[0].outcome).toBe('DEAD');
      expect(summary.dead).toBe(1);
    });

    it('RetryAfter: FAILED y el proveedor queda pausado, así el siguiente no se reclama', async () => {
      const connector = new ScriptedConnector('fake', async () =>
        fail({ kind: 'RetryAfter', seconds: 600, message: 'espere' }),
      );
      const { useCase, jobs, settings } = setup(connector);
      jobs.add(makeJob({ id: 'a', idempotencyKey: 'a' }));
      jobs.add(makeJob({ id: 'b', idempotencyKey: 'b' }));
      const summary = await useCase.execute();
      expect(summary.processed).toBe(1);
      expect(settings.rows.get('fake')?.props.pausedUntil).toEqual(
        new Date(NOW.getTime() + 600_000),
      );
      expect(jobs.jobs.get('b')?.status).toBe('PENDING');
    });

    it('BudgetExhausted con resetAt: DEAD y pausa hasta esa fecha', async () => {
      const resetAt = new Date('2026-12-01T00:00:00Z');
      const connector = new ScriptedConnector('fake', async () =>
        fail({ kind: 'BudgetExhausted', resetAt, message: 'tope' }),
      );
      const { useCase, jobs, settings } = setup(connector);
      jobs.add(makeJob());
      await useCase.execute();
      expect(jobs.jobs.get('job-1')?.status).toBe('DEAD');
      expect(settings.rows.get('fake')?.props.pausedUntil).toEqual(resetAt);
    });

    it('un conector que lanza se trata como Transient', async () => {
      const connector = new ScriptedConnector('fake', async () => {
        throw new Error('explotó');
      });
      const { useCase, jobs } = setup(connector);
      jobs.add(makeJob());
      await useCase.execute();
      expect(jobs.jobs.get('job-1')).toMatchObject({ status: 'FAILED' });
      expect(jobs.jobs.get('job-1')?.props.lastErrorClass).toBe('Transient');
    });

    it('sin credencial el trabajo queda DEAD con «falta la credencial»; ilegible, con el mensaje de rekey', async () => {
      const { useCase, jobs, credentials } = setup(okConnector());
      jobs.add(makeJob());
      credentials.result = fail(new CredentialUnreadableError());
      await useCase.execute();
      expect(jobs.jobs.get('job-1')?.status).toBe('DEAD');
      expect(jobs.jobs.get('job-1')?.props.lastError).toMatch(/integrations:rekey/);
    });
  });

  it('un mensaje de fallo que contiene el secreto se guarda redactado', async () => {
    const connector = new ScriptedConnector('fake', async () =>
      fail({ kind: 'Transient', message: `falló con ${SECRET} en el header` }),
    );
    const { useCase, jobs, syncRuns, loggers } = setup(connector);
    jobs.add(makeJob());
    await useCase.execute();
    expect(jobs.jobs.get('job-1')?.props.lastError).toContain('[Redacted]');
    expect(jobs.jobs.get('job-1')?.props.lastError).not.toContain(SECRET);
    expect(syncRuns.runs[0].errorMessage).not.toContain(SECRET);
    expect(JSON.stringify(loggers.logger.lines)).not.toContain(SECRET);
  });

  it('un conector que lanza con el secreto en el mensaje también se redacta', async () => {
    const connector = new ScriptedConnector('fake', async () => {
      throw new Error(`Bearer ${SECRET} rechazado`);
    });
    const { useCase, jobs } = setup(connector);
    jobs.add(makeJob());
    await useCase.execute();
    expect(jobs.jobs.get('job-1')?.props.lastError).not.toContain(SECRET);
  });

  describe('timeout', () => {
    it('aborta la señal y cierra con TIMEOUT aunque el conector no resuelva nunca', async () => {
      let signal: AbortSignal | undefined;
      const connector = new ScriptedConnector('fake', (_ctx, s) => {
        signal = s;
        return new Promise(() => undefined);
      });
      const { useCase, jobs, syncRuns } = setup(connector, { jobTimeoutMs: 30 });
      jobs.add(makeJob());
      await useCase.execute();
      expect(signal?.aborted).toBe(true);
      expect(jobs.jobs.get('job-1')?.status).toBe('FAILED');
      expect(syncRuns.runs[0].outcome).toBe('TIMEOUT');
    });
  });

  describe('apagado', () => {
    it('con la señal ya abortada no reclama trabajos', async () => {
      const connector = okConnector();
      const { useCase, jobs } = setup(connector);
      jobs.add(makeJob());
      const controller = new AbortController();
      controller.abort();
      const summary = await useCase.execute({ shutdown: controller.signal });
      expect(summary.processed).toBe(0);
      expect(connector.calls).toBe(0);
    });

    it('un trabajo en curso que reacciona a la señal vuelve a PENDING sin consumir el intento', async () => {
      const controller = new AbortController();
      const connector = new ScriptedConnector(
        'fake',
        (_ctx, signal) =>
          new Promise((resolve) => {
            signal.addEventListener('abort', () =>
              resolve(fail({ kind: 'Transient', message: 'abortado' })),
            );
            controller.abort();
          }),
      );
      const { useCase, jobs, syncRuns, lease } = setup(connector);
      jobs.add(makeJob());
      const summary = await useCase.execute({ shutdown: controller.signal });
      expect(summary.interrupted).toBe(1);
      expect(jobs.jobs.get('job-1')).toMatchObject({ status: 'PENDING' });
      expect(jobs.jobs.get('job-1')?.attempts).toBe(0);
      expect(syncRuns.runs[0].outcome).toBe('INTERRUPTED');
      expect(lease.holder).toBeNull();
    });
  });

  it('libera el arriendo al final, también si un repositorio lanza', async () => {
    const { useCase, jobs, lease } = setup(okConnector());
    jobs.add(makeJob());
    jobs.save = async () => {
      throw new Error('base caída');
    };
    await expect(useCase.execute()).rejects.toThrow('base caída');
    expect(lease.holder).toBeNull();
  });

  it('el logger de cada trabajo lleva syncRunId, jobId y provider', async () => {
    const { useCase, jobs, loggers, syncRuns } = setup(okConnector());
    jobs.add(makeJob());
    await useCase.execute();
    expect(loggers.contexts).toEqual([
      { syncRunId: syncRuns.runs[0].id, jobId: 'job-1', provider: 'fake' },
    ]);
  });
});
