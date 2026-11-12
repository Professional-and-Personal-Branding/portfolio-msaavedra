/**
 * E2E — cola de integraciones (change `add-integrations-foundation`, D4, D7, D15, D23):
 * `SKIP LOCKED`, ejecutores en paralelo, locks vencidos, arriendo, idempotencia, reintentos,
 * retención y snapshots, con el proveedor `fake` contra Postgres.
 */
import { IntegrationJobStatus } from '@prisma/client';
import { PlanDueSyncsUseCase } from '../src/modules/integrations/application/use-cases/plan-due-syncs.use-case';
import { RunDueJobsUseCase } from '../src/modules/integrations/application/use-cases/run-due-jobs.use-case';
import {
  INTEGRATION_JOB_REPOSITORY,
  IntegrationJobRepository,
} from '../src/modules/integrations/domain/repositories/integration-job.repository';
import {
  INTEGRATION_SETTING_REPOSITORY,
  IntegrationSettingRepository,
} from '../src/modules/integrations/domain/repositories/integration-setting.repository';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';
import {
  addJob,
  buildExecutor,
  cleanIntegrations,
  createIntegrationsApp,
  IntegrationsTestApp,
} from './integrations-helpers';

const DAY = 86_400_000;

/** Corta con un error claro en vez de colgar el test si una consulta se queda esperando un lock. */
function within<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<T>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${what}: esperó más de ${ms} ms (¿bloqueado?)`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

describe('Cola de integraciones (e2e)', () => {
  let ctx: IntegrationsTestApp;
  let prisma: PrismaService;
  let executor: RunDueJobsUseCase;

  const statusOf = async (id: string): Promise<IntegrationJobStatus> =>
    (await prisma.integrationJob.findUniqueOrThrow({ where: { id } })).status;

  beforeAll(async () => {
    ctx = await createIntegrationsApp();
    prisma = ctx.prisma;
    executor = ctx.app.get(RunDueJobsUseCase);
  });

  beforeEach(async () => {
    await cleanIntegrations(prisma);
    ctx.fake.resetCalls();
  });

  afterAll(async () => {
    await cleanIntegrations(prisma);
    await ctx.close();
  });

  it('SKIP LOCKED: con el trabajo A bloqueado por otra transacción, la corrida toma B sin esperar', async () => {
    const a = await addJob(prisma, { key: 'q:a', runAt: new Date(Date.now() - 20_000) });
    const b = await addJob(prisma, { key: 'q:b', runAt: new Date(Date.now() - 10_000) });

    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "IntegrationJob" WHERE id = ${a.id} FOR UPDATE`;
        const summary = await within(executor.execute(), 5000, 'corrida con A bloqueado');
        expect(summary.processed).toBe(1);
      },
      { timeout: 15_000 },
    );

    expect(await statusOf(b.id)).toBe('DONE');
    expect(await statusOf(a.id)).toBe('PENDING');
  });

  it('reclamos concurrentes: cada trabajo lo toma exactamente una conexión', async () => {
    for (let i = 0; i < 6; i++) await addJob(prisma, { key: `q:c${i}` });
    const repo = ctx.app.get<IntegrationJobRepository>(INTEGRATION_JOB_REPOSITORY);
    const claims = await Promise.all(
      Array.from({ length: 12 }, (_, i) => repo.claimNext(['fake'], 60_000, `h${i}`)),
    );
    const claimed = claims.filter((job) => job !== null);
    expect(claimed).toHaveLength(6);
    expect(new Set(claimed.map((job) => job.id)).size).toBe(6);
    expect(claimed.every((job) => job.attempts === 1)).toBe(true);
  });

  it('dos ejecutores en paralelo con 5 trabajos: una SyncRun por trabajo y el conector llamado 5 veces', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push((await addJob(prisma, { key: `q:p${i}` })).id);
    const one = buildExecutor(ctx.app, 'holder-uno');
    const two = buildExecutor(ctx.app, 'holder-dos');

    const [s1, s2] = await Promise.all([one.execute(), two.execute()]);

    expect(s1.processed + s2.processed).toBe(5);
    expect(ctx.fake.totalCalls).toBe(5);
    for (const id of ids) {
      expect(await statusOf(id)).toBe('DONE');
      expect(await prisma.syncRun.count({ where: { jobId: id } })).toBe(1);
    }
  });

  it('lock vencido: un RUNNING queda FAILED con «lock vencido» y otro con 8/8 queda DEAD', async () => {
    const past = new Date(Date.now() - 60_000);
    const failed = await addJob(prisma, {
      key: 'q:l1',
      status: 'RUNNING',
      attempts: 2,
      lockedUntil: past,
      lockedBy: 'muerto',
    });
    const dead = await addJob(prisma, {
      key: 'q:l2',
      status: 'RUNNING',
      attempts: 8,
      lockedUntil: past,
      lockedBy: 'muerto',
    });

    await executor.execute();

    const failedRow = await prisma.integrationJob.findUniqueOrThrow({ where: { id: failed.id } });
    expect(failedRow.status).toBe('FAILED');
    expect(failedRow.lastError).toBe('lock vencido');
    expect(failedRow.lockedBy).toBeNull();
    expect(await statusOf(dead.id)).toBe('DEAD');
  });

  it('arriendo abandonado: con el de otro holder vigente no se ejecuta nada; vencido, se toma', async () => {
    const job = await addJob(prisma, { key: 'q:lease' });
    await prisma.$executeRaw`UPDATE "IntegrationRunnerLease" SET holder = 'otro', "expiresAt" = (now() AT TIME ZONE 'UTC') + interval '10 minutes' WHERE id = 'runner'`;

    const blocked = await executor.execute();
    expect(blocked.leased).toBe(false);
    expect(await statusOf(job.id)).toBe('PENDING');
    expect(ctx.fake.totalCalls).toBe(0);

    await prisma.$executeRaw`UPDATE "IntegrationRunnerLease" SET "expiresAt" = (now() AT TIME ZONE 'UTC') - interval '1 minute' WHERE id = 'runner'`;
    const taken = await executor.execute();
    expect(taken.leased).toBe(true);
    expect(await statusOf(job.id)).toBe('DONE');
    // Al terminar, el arriendo queda libre para cualquiera.
    const lease = await prisma.integrationRunnerLease.findUniqueOrThrow({
      where: { id: 'runner' },
    });
    expect(lease.expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('idempotencia: dos PlanDueSyncs del mismo día y dos enqueue con la misma clave dejan un trabajo', async () => {
    const plan = ctx.app.get(PlanDueSyncsUseCase);
    await plan.execute();
    await plan.execute();
    expect(
      await prisma.integrationJob.count({
        where: { idempotencyKey: { startsWith: 'sync:fake:daily:' } },
      }),
    ).toBe(1);

    const repo = ctx.app.get<IntegrationJobRepository>(INTEGRATION_JOB_REPOSITORY);
    const input = {
      provider: 'fake',
      kind: 'sync',
      idempotencyKey: 'q:idem',
      payload: {},
      runAt: new Date(),
    };
    const [first, second] = await Promise.all([repo.enqueue(input), repo.enqueue(input)]);
    expect([first.created, second.created].filter(Boolean)).toHaveLength(1);
    expect(first.job.id).toBe(second.job.id);
    expect(await prisma.integrationJob.count({ where: { idempotencyKey: 'q:idem' } })).toBe(1);
  });

  describe('reintentos y clasificación', () => {
    it('transient deja FAILED con runAt futuro y attempts = 1', async () => {
      const job = await addJob(prisma, { key: 'q:t', payload: { scenario: 'transient' } });
      await executor.execute();
      const row = await prisma.integrationJob.findUniqueOrThrow({ where: { id: job.id } });
      expect(row.status).toBe('FAILED');
      expect(row.attempts).toBe(1);
      expect(row.runAt.getTime()).toBeGreaterThan(Date.now());
      expect(row.lastErrorClass).toBe('Transient');
    });

    it.each(['permanent', 'budget'])('%s deja DEAD', async (scenario) => {
      const job = await addJob(prisma, { key: `q:${scenario}`, payload: { scenario } });
      await executor.execute();
      expect(await statusOf(job.id)).toBe('DEAD');
    });

    it('retry-after pausa el proveedor y el siguiente trabajo no se reclama', async () => {
      const first = await addJob(prisma, {
        key: 'q:ra1',
        payload: { scenario: 'retry-after', seconds: 600 },
        runAt: new Date(Date.now() - 5000),
      });
      const second = await addJob(prisma, { key: 'q:ra2', runAt: new Date(Date.now() - 1000) });

      const summary = await executor.execute();

      expect(summary.processed).toBe(1);
      expect(await statusOf(first.id)).toBe('FAILED');
      expect(await statusOf(second.id)).toBe('PENDING');
      const setting = await prisma.integrationSetting.findUniqueOrThrow({
        where: { provider: 'fake' },
      });
      expect(setting.pauseReason).toBe('RetryAfter');
      expect(setting.pausedUntil!.getTime()).toBeGreaterThan(Date.now() + 500_000);
      // Pausado: otra corrida tampoco lo toca.
      expect((await executor.execute()).processed).toBe(0);
      expect(ctx.fake.callsFor('ok')).toBe(0);
    });

    it('un proveedor pausado a mano no se reclama', async () => {
      const job = await addJob(prisma, { key: 'q:off' });
      const settings = ctx.app.get<IntegrationSettingRepository>(INTEGRATION_SETTING_REPOSITORY);
      const now = new Date();
      await settings.saveEnabled((await settings.getOrCreate('fake', now)).withEnabled(false, now));
      expect((await executor.execute()).processed).toBe(0);
      expect(await statusOf(job.id)).toBe('PENDING');
    });

    it('un conector que lanza deja el trabajo FAILED (Transient)', async () => {
      const job = await addJob(prisma, { key: 'q:throw', payload: { scenario: 'throw' } });
      await executor.execute();
      const row = await prisma.integrationJob.findUniqueOrThrow({ where: { id: job.id } });
      expect(row.status).toBe('FAILED');
      expect(row.lastErrorClass).toBe('Transient');
    });
  });

  it('retención: un DONE de 31 días se borra con sus corridas y un DEAD de 31 días queda', async () => {
    const old = new Date(Date.now() - 31 * DAY);
    const done = await addJob(prisma, { key: 'q:old-done', status: 'DONE', finishedAt: old });
    const dead = await addJob(prisma, { key: 'q:old-dead', status: 'DEAD', finishedAt: old });
    await prisma.syncRun.create({ data: { jobId: done.id, provider: 'fake', startedAt: old } });

    const result = await ctx.app.get(PlanDueSyncsUseCase).execute();

    expect(result.purged.jobs).toBeGreaterThanOrEqual(1);
    expect(await prisma.integrationJob.findUnique({ where: { id: done.id } })).toBeNull();
    expect(await prisma.syncRun.count({ where: { jobId: done.id } })).toBe(0);
    expect(await statusOf(dead.id)).toBe('DEAD');
  });

  it('retención: un DEAD de más de 90 días y las SyncRun de más de 90 días se borran', async () => {
    const veryOld = new Date(Date.now() - 91 * DAY);
    const dead = await addJob(prisma, { key: 'q:vold-dead', status: 'DEAD', finishedAt: veryOld });
    const recent = await addJob(prisma, {
      key: 'q:recent',
      status: 'DONE',
      finishedAt: new Date(),
    });
    await prisma.syncRun.create({
      data: { jobId: recent.id, provider: 'fake', startedAt: veryOld },
    });

    await ctx.app.get(PlanDueSyncsUseCase).execute();

    expect(await prisma.integrationJob.findUnique({ where: { id: dead.id } })).toBeNull();
    expect(await prisma.integrationJob.findUnique({ where: { id: recent.id } })).not.toBeNull();
    expect(await prisma.syncRun.count({ where: { jobId: recent.id } })).toBe(0);
  });

  describe('snapshots', () => {
    it('ok dos veces: el segundo no cambia nada y solo se mueve fetchedAt', async () => {
      const first = await addJob(prisma, { key: 'q:s1' });
      await executor.execute();
      const snap1 = await prisma.externalSnapshot.findUniqueOrThrow({
        where: { provider_resourceKey: { provider: 'fake', resourceKey: 'fake:items' } },
      });

      await new Promise((r) => setTimeout(r, 20));
      const second = await addJob(prisma, { key: 'q:s2' });
      await executor.execute();
      const snap2 = await prisma.externalSnapshot.findUniqueOrThrow({
        where: { provider_resourceKey: { provider: 'fake', resourceKey: 'fake:items' } },
      });

      expect(
        (await prisma.syncRun.findFirstOrThrow({ where: { jobId: first.id } })).itemsChanged,
      ).toBe(1);
      expect(
        (await prisma.syncRun.findFirstOrThrow({ where: { jobId: second.id } })).itemsChanged,
      ).toBe(0);
      expect(snap2.contentHash).toBe(snap1.contentHash);
      expect(snap2.changedAt.getTime()).toBe(snap1.changedAt.getTime());
      expect(snap2.fetchedAt.getTime()).toBeGreaterThan(snap1.fetchedAt.getTime());
    });

    it('not-modified solo mueve fetchedAt', async () => {
      await addJob(prisma, { key: 'q:n1' });
      await executor.execute();
      const before = await prisma.externalSnapshot.findUniqueOrThrow({
        where: { provider_resourceKey: { provider: 'fake', resourceKey: 'fake:items' } },
      });
      await new Promise((r) => setTimeout(r, 20));
      await addJob(prisma, { key: 'q:n2', payload: { scenario: 'not-modified' } });
      await executor.execute();
      const after = await prisma.externalSnapshot.findUniqueOrThrow({
        where: { provider_resourceKey: { provider: 'fake', resourceKey: 'fake:items' } },
      });
      expect(after.contentHash).toBe(before.contentHash);
      expect(after.changedAt.getTime()).toBe(before.changedAt.getTime());
      expect(after.fetchedAt.getTime()).toBeGreaterThan(before.fetchedAt.getTime());
    });

    it('un contenido distinto reemplaza el snapshot y marca el cambio', async () => {
      await addJob(prisma, { key: 'q:d1' });
      await executor.execute();
      await addJob(prisma, { key: 'q:d2', payload: { items: [9, 9] } });
      await executor.execute();
      const run = await prisma.syncRun.findFirstOrThrow({
        where: { job: { idempotencyKey: 'q:d2' } },
      });
      expect(run.itemsChanged).toBe(1);
    });
  });
});
