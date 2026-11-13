/**
 * E2E — apagado ordenado (change `add-integrations-foundation`, D6). Con el scheduler encendido
 * y un trabajo en curso lanzado como lo hace el tick (por `BackgroundTasks`), `app.close()` tiene
 * que terminar dentro del drenaje de 5 s, devolver el trabajo a `PENDING` sin consumir el
 * intento, registrar la corrida como `INTERRUPTED`, liberar el arriendo y no dejar errores de
 * conexión cerrada.
 */
import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { IntegrationsScheduler } from '../src/modules/integrations/infrastructure/scheduler/integrations-scheduler';
import {
  addJob,
  cleanIntegrations,
  createIntegrationsApp,
  IntegrationsTestApp,
} from './integrations-helpers';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('Apagado ordenado de las integraciones (e2e, D6)', () => {
  let inspector: PrismaClient;

  beforeAll(() => {
    inspector = new PrismaClient();
  });

  afterAll(async () => {
    await cleanIntegrations(inspector);
    await inspector.$disconnect();
  });

  /** Arranca la app, deja un trabajo en curso vía `tick()` y la cierra midiendo cuánto tarda. */
  async function closeWithRunningJob(payload: Record<string, unknown>) {
    const ctx: IntegrationsTestApp = await createIntegrationsApp({
      schedulerEnabled: true,
      tickSeconds: 3600,
    });
    await cleanIntegrations(ctx.prisma);
    const job = await addJob(ctx.prisma, { key: `shutdown:${Date.now()}`, payload });
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      ctx.app.get(IntegrationsScheduler).tick();
      // Espera a que el trabajo esté realmente RUNNING.
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const row = await ctx.prisma.integrationJob.findUniqueOrThrow({ where: { id: job.id } });
        if (row.status === 'RUNNING') break;
        await sleep(25);
      }
      expect(
        (await ctx.prisma.integrationJob.findUniqueOrThrow({ where: { id: job.id } })).status,
      ).toBe('RUNNING');

      const started = Date.now();
      await ctx.app.close();
      const elapsed = Date.now() - started;
      return { job, elapsed, errors: errorSpy.mock.calls.map((call) => String(call[0])), ctx };
    } finally {
      errorSpy.mockRestore();
      ctx.restoreEnv();
    }
  }

  async function assertInterrupted(jobId: string, errors: string[]): Promise<void> {
    const row = await inspector.integrationJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(row.status).toBe('PENDING');
    // El intento que consumió el reclamo se devuelve: queda como estaba antes (0).
    expect(row.attempts).toBe(0);
    expect(row.lockedBy).toBeNull();
    const run = await inspector.syncRun.findFirstOrThrow({ where: { jobId } });
    expect(run.outcome).toBe('INTERRUPTED');
    expect(run.finishedAt).not.toBeNull();
    const lease = await inspector.integrationRunnerLease.findUniqueOrThrow({
      where: { id: 'runner' },
    });
    expect(lease.expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(errors.filter((line) => /closed|connection|Falló la tarea/i.test(line))).toEqual([]);
  }

  it('un conector que respeta la señal: cierra rápido y el trabajo vuelve a PENDING', async () => {
    const { job, elapsed, errors } = await closeWithRunningJob({
      scenario: 'slow',
      steps: 200,
      stepMs: 100,
    });
    console.log(`APAGADO con un trabajo lento que respeta la señal: app.close() = ${elapsed} ms`);
    expect(elapsed).toBeLessThan(5000);
    await assertInterrupted(job.id, errors);
  }, 30_000);

  it('un conector que ignora la señal: el ejecutor no lo espera más de 3 s y el cierre entra en 5 s', async () => {
    const { job, elapsed, errors } = await closeWithRunningJob({
      scenario: 'ignore-abort',
      ms: 30_000,
    });
    console.log(`APAGADO con un conector que ignora la señal: app.close() = ${elapsed} ms`);
    expect(elapsed).toBeLessThan(5000);
    await assertInterrupted(job.id, errors);
  }, 30_000);
});
