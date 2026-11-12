/**
 * E2E — una petición no se demora mientras corre un trabajo (change `add-integrations-foundation`,
 * D22 y condición del owner de no generar cuellos de botella). Con la app completa y el conector
 * `fake` en el escenario `slow` (3 s en 30 pasos y, en cada uno, 5 ms de CPU sincrónica que
 * simulan parsear una página de respuesta), se mide `GET /health/live` sin trabajo y con él.
 *
 * Umbrales (D22): p95 ≤ línea de base + 25 ms, máximo ≤ 150 ms y p99 del retardo del event loop
 * ≤ 50 ms. Si el p95 fallara por ruido del runner se suben las muestras, no el umbral.
 */
import { monitorEventLoopDelay } from 'perf_hooks';
import request from 'supertest';
import { RunDueJobsUseCase } from '../src/modules/integrations/application/use-cases/run-due-jobs.use-case';
import { createE2eAdmin, deleteE2eAdmin, loginCookie } from './e2e-helpers';
import {
  addJob,
  cleanIntegrations,
  createIntegrationsApp,
  IntegrationsTestApp,
} from './integrations-helpers';

const SAMPLES = 40;
const PACE_MS = 60;
const BASELINE_MARGIN_MS = 25;
const MAX_LATENCY_MS = 150;
const EVENT_LOOP_P99_MS = 50;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

describe('Latencia de /health/live con un trabajo en curso (e2e, D22)', () => {
  let ctx: IntegrationsTestApp;
  let cookie: string;

  beforeAll(async () => {
    // Scheduler encendido con el tick mínimo: es la configuración que se mide. La corrida
    // se dispara directamente para no esperar al tick.
    ctx = await createIntegrationsApp({ schedulerEnabled: true, tickSeconds: 10 });
    await createE2eAdmin(ctx.prisma);
    cookie = await loginCookie(ctx.app);
  });

  beforeEach(async () => {
    await cleanIntegrations(ctx.prisma);
  });

  afterAll(async () => {
    await cleanIntegrations(ctx.prisma);
    await deleteE2eAdmin(ctx.prisma);
    await ctx.close();
  });

  async function sample(count: number): Promise<number[]> {
    const latencies: number[] = [];
    for (let i = 0; i < count; i++) {
      const started = performance.now();
      const res = await request(ctx.app.getHttpServer()).get('/health/live');
      latencies.push(performance.now() - started);
      expect(res.status).toBe(200);
      await sleep(PACE_MS);
    }
    return latencies;
  }

  it('el trabajo lento no demora las peticiones ni bloquea el event loop', async () => {
    await sample(5); // calentamiento: rutas, JIT y conexión

    const baseline = (await sample(SAMPLES)).sort((a, b) => a - b);

    const job = await addJob(ctx.prisma, {
      key: 'latency:slow',
      payload: { scenario: 'slow', steps: 30, stepMs: 100, workMs: 5 },
    });
    const histogram = monitorEventLoopDelay({ resolution: 10 });
    histogram.enable();
    let jobSettled = false;
    const running = ctx.app
      .get(RunDueJobsUseCase)
      .execute()
      .finally(() => {
        jobSettled = true;
      });

    const during = (await sample(SAMPLES)).sort((a, b) => a - b);
    const stillRunning = !jobSettled;
    await running;
    histogram.disable();

    // La medición solo vale si el trabajo estuvo corriendo durante las muestras.
    expect(stillRunning).toBe(true);
    const run = await ctx.prisma.syncRun.findFirstOrThrow({ where: { jobId: job.id } });
    expect(run.outcome).toBe('SUCCESS');
    expect(run.durationMs).toBeGreaterThanOrEqual(3000);

    const stats = {
      baselineP50: percentile(baseline, 50),
      baselineP95: percentile(baseline, 95),
      baselineMax: baseline[baseline.length - 1],
      duringP50: percentile(during, 50),
      duringP95: percentile(during, 95),
      duringMax: during[during.length - 1],
      eventLoopP99: histogram.percentile(99) / 1e6,
      eventLoopMax: histogram.max / 1e6,
      jobMs: run.durationMs,
    };
    console.log(
      `LATENCIA /health/live (ms) línea de base: p50=${stats.baselineP50.toFixed(1)} p95=${stats.baselineP95.toFixed(1)} max=${stats.baselineMax.toFixed(1)} | ` +
        `con trabajo (${stats.jobMs} ms): p50=${stats.duringP50.toFixed(1)} p95=${stats.duringP95.toFixed(1)} max=${stats.duringMax.toFixed(1)} | ` +
        `event loop (resolución 10 ms): p99=${stats.eventLoopP99.toFixed(1)} max=${stats.eventLoopMax.toFixed(1)}`,
    );

    expect(stats.duringP95).toBeLessThanOrEqual(stats.baselineP95 + BASELINE_MARGIN_MS);
    expect(stats.duringMax).toBeLessThanOrEqual(MAX_LATENCY_MS);
    expect(stats.eventLoopP99).toBeLessThanOrEqual(EVENT_LOOP_P99_MS);
  }, 60_000);

  it('«Sincronizar ahora» responde 202 en milisegundos y sin llamar al conector con un trabajo lento en curso', async () => {
    const job = await addJob(ctx.prisma, {
      key: 'latency:busy',
      payload: { scenario: 'slow', steps: 10, stepMs: 100, workMs: 5 },
    });
    ctx.fake.resetCalls();
    const running = ctx.app.get(RunDueJobsUseCase).execute();
    await sleep(200);
    expect(ctx.fake.callsFor('slow')).toBe(1);

    const started = performance.now();
    const res = await request(ctx.app.getHttpServer())
      .post('/api/admin/integrations/fake/sync')
      .set('Cookie', cookie);
    const elapsed = performance.now() - started;

    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({ jobId: job.id, alreadyQueued: true });
    expect(elapsed).toBeLessThan(MAX_LATENCY_MS);
    // El conector no se llamó otra vez por la petición.
    expect(ctx.fake.totalCalls).toBe(1);
    console.log(`SINCRONIZAR AHORA con un trabajo en curso: ${elapsed.toFixed(1)} ms`);

    await running;
    expect((await ctx.prisma.syncRun.findFirstOrThrow({ where: { jobId: job.id } })).outcome).toBe(
      'SUCCESS',
    );
  }, 30_000);
});
