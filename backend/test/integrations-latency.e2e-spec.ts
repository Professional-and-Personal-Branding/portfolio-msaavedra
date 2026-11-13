/**
 * E2E — una petición no se demora mientras corre un trabajo (change `add-integrations-foundation`,
 * D22 y condición del owner de no generar cuellos de botella). Con la app completa y el conector
 * `fake` en el escenario `slow` (~6 s en 60 pasos y, en cada uno, 5 ms de CPU sincrónica que
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

/**
 * Pasos del trabajo lento (100 ms cada uno, 5 ms de CPU sincrónica). D22 pide ~3 s en 30 pasos; se usan
 * 60 (~6 s) para que las 40 muestras pacientes (~2,6 s con la máquina quieta) terminen siempre mientras el
 * trabajo sigue corriendo, incluso en un runner o una máquina cargados.
 */
const JOB_STEPS = 60;
const SAMPLES = 40;
const MAX_ATTEMPTS = 3;
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

  interface Attempt {
    stats: Record<string, number>;
    failures: string[];
  }

  /** Una medición completa: línea de base sin trabajo y luego las mismas muestras con el trabajo lento. */
  async function measure(n: number): Promise<Attempt> {
    await cleanIntegrations(ctx.prisma);
    await sample(5); // calentamiento: rutas, JIT y conexión
    const baseline = (await sample(SAMPLES)).sort((a, b) => a - b);

    const job = await addJob(ctx.prisma, {
      key: `latency:slow:${n}`,
      payload: { scenario: 'slow', steps: JOB_STEPS, stepMs: 100, workMs: 5 },
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

    const run = await ctx.prisma.syncRun.findFirstOrThrow({ where: { jobId: job.id } });
    const stats = {
      baselineP50: percentile(baseline, 50),
      baselineP95: percentile(baseline, 95),
      baselineMax: baseline[baseline.length - 1],
      duringP50: percentile(during, 50),
      duringP95: percentile(during, 95),
      duringMax: during[during.length - 1],
      eventLoopP99: histogram.percentile(99) / 1e6,
      eventLoopMax: histogram.max / 1e6,
      jobMs: run.durationMs ?? 0,
    };
    console.log(
      `LATENCIA intento ${n} /health/live (ms) línea de base: p50=${stats.baselineP50.toFixed(1)} p95=${stats.baselineP95.toFixed(1)} max=${stats.baselineMax.toFixed(1)} | ` +
        `con trabajo (${stats.jobMs} ms): p50=${stats.duringP50.toFixed(1)} p95=${stats.duringP95.toFixed(1)} max=${stats.duringMax.toFixed(1)} | ` +
        `event loop (resolución 10 ms): p99=${stats.eventLoopP99.toFixed(1)} max=${stats.eventLoopMax.toFixed(1)}`,
    );

    // La medición solo vale si el trabajo estuvo corriendo durante todas las muestras y terminó bien.
    expect(stillRunning).toBe(true);
    expect(run.outcome).toBe('SUCCESS');
    expect(stats.jobMs).toBeGreaterThanOrEqual(5000);

    const failures: string[] = [];
    if (stats.duringP95 > stats.baselineP95 + BASELINE_MARGIN_MS) {
      failures.push(
        `p95 ${stats.duringP95.toFixed(1)} > línea de base ${stats.baselineP95.toFixed(1)} + ${BASELINE_MARGIN_MS}`,
      );
    }
    if (stats.duringMax > MAX_LATENCY_MS)
      failures.push(`máximo ${stats.duringMax.toFixed(1)} > ${MAX_LATENCY_MS}`);
    if (stats.eventLoopP99 > EVENT_LOOP_P99_MS) {
      failures.push(`p99 del event loop ${stats.eventLoopP99.toFixed(1)} > ${EVENT_LOOP_P99_MS}`);
    }
    return { stats, failures };
  }

  /**
   * Hasta 3 intentos: en una máquina compartida (o un runner con vecinos ruidosos) un proceso ajeno puede
   * frenar al nuestro unos cientos de milisegundos y eso solo puede EMPEORAR la medición. Un trabajo que de
   * verdad bloquea el event loop (CPU sincrónica larga, una conexión retenida) falla en todos los intentos;
   * el umbral no se toca. Cada intento imprime sus números.
   */
  it('el trabajo lento no demora las peticiones ni bloquea el event loop', async () => {
    const attempts: Attempt[] = [];
    for (let n = 1; n <= MAX_ATTEMPTS; n++) {
      const attempt = await measure(n);
      attempts.push(attempt);
      if (attempt.failures.length === 0) break;
      console.log(`LATENCIA intento ${n} fuera de umbral: ${attempt.failures.join('; ')}`);
    }
    const passed = attempts.some((a) => a.failures.length === 0);
    expect(passed ? [] : attempts.map((a) => a.failures)).toEqual([]);
  }, 150_000);

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
