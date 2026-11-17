/**
 * E2E — base de IA (change `add-ai-foundation`, D6 a D14, D18): panel de uso y prueba de conexión
 * con el proveedor `fake`, presupuesto contra Postgres real, bloqueos por spend limit, ruta
 * pública aislada y frontera de datos. Ninguna prueba llama a Anthropic.
 */
import { randomUUID } from 'crypto';
import request from 'supertest';
import {
  AI_BUDGET_REPOSITORY,
  AiBudgetRepository,
} from '../src/modules/ai/application/ports/ai-repositories';
import { AI_TASK_RUNNER } from '../src/modules/ai/application/ports/ai-support.ports';
import { AiTaskRunner } from '../src/modules/ai/application/services/ai-task-runner';
import { BudgetGuard, budgetMonthOf } from '../src/modules/ai/application/services/budget-guard';
import { aiSmokeTask } from '../src/modules/ai/application/tasks/ai-smoke.task';
import { AiRun } from '../src/modules/ai/domain/ai-run.entity';
import { systemClock } from '../src/shared/domain/clock';
import { AiTestApp, cleanAi, createAiApp } from './ai-helpers';
import { createE2eAdmin, deleteE2eAdmin, loginCookie } from './e2e-helpers';

const USAGE = '/api/admin/ai/usage';
const SMOKE = '/api/admin/ai/smoke';

function authed(ctx: AiTestApp, cookie: string) {
  const http = () => request(ctx.app.getHttpServer());
  return {
    get: (url: string) => http().get(url).set('Cookie', cookie),
    post: (url: string) => http().post(url).set('Cookie', cookie),
  };
}

describe('IA con el proveedor fake (e2e)', () => {
  let ctx: AiTestApp;
  let cookie: string;

  beforeAll(async () => {
    ctx = await createAiApp({ AI_ENABLED: 'true', AI_PROVIDER: 'fake' });
    await createE2eAdmin(ctx.prisma);
    cookie = await loginCookie(ctx.app);
  });

  beforeEach(async () => {
    await cleanAi(ctx.prisma);
    ctx.completeSpy.mockClear();
    ctx.countSpy.mockClear();
  });

  afterAll(async () => {
    await cleanAi(ctx.prisma);
    await deleteE2eAdmin(ctx.prisma);
    await ctx.close();
  });

  it('(h) las dos rutas exigen sesión (401)', async () => {
    const http = () => request(ctx.app.getHttpServer());
    expect((await http().get(USAGE)).status).toBe(401);
    expect((await http().post(SMOKE)).status).toBe(401);
  });

  it('(a) la prueba de conexión da 201 con una corrida SUCCEEDED de Haiku y el uso la refleja', async () => {
    const res = await authed(ctx, cookie).post(SMOKE);
    expect(res.status).toBe(201);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toMatchObject({
      task: 'ai.smoke',
      promptVersion: 1,
      model: 'claude-haiku-5-5',
      status: 'SUCCEEDED',
      inputTokens: 200,
      outputTokens: 50,
      costMicroUsd: 45,
      fromCache: false,
    });
    // La entrada y la salida no viajan en la respuesta.
    expect(Object.keys(res.body)).not.toEqual(expect.arrayContaining(['output', 'input']));

    const usage = await authed(ctx, cookie).get(USAGE);
    expect(usage.status).toBe(200);
    expect(usage.body).toMatchObject({
      enabled: true,
      provider: 'fake',
      budgetUsd: 10,
      state: 'OK',
      spentUsd: 0.000045,
      reservedUsd: 0,
      pricingVerifiedAt: '2026-11-17',
    });
    expect(usage.body.recentRuns).toHaveLength(1);
    const row = await ctx.prisma.aiRun.findFirstOrThrow();
    expect(row.output).toEqual({ estado: 'ok' });
    expect(row.inputHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('(a) un segundo humo vuelve a llamar al adaptador y ninguna corrida queda CACHED', async () => {
    await authed(ctx, cookie).post(SMOKE);
    const second = await authed(ctx, cookie).post(SMOKE);
    expect(second.body.status).toBe('SUCCEEDED');
    expect(ctx.completeSpy).toHaveBeenCalledTimes(2);
    expect(await ctx.prisma.aiRun.count({ where: { status: 'CACHED' } })).toBe(0);
  });

  it('(b) el runner con la misma entrada y sin bypassCache: la segunda es CACHED con una sola llamada', async () => {
    const runner = ctx.app.get<AiTaskRunner>(AI_TASK_RUNNER);
    const first = await runner.run(aiSmokeTask, { caso: 'cache-e2e' });
    const second = await runner.run(aiSmokeTask, { caso: 'cache-e2e' });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value.run.status).toBe('SUCCEEDED');
      expect(second.value.run.status).toBe('CACHED');
      expect(second.value.run.props.costMicroUsd).toBe(0);
    }
    expect(ctx.completeSpy).toHaveBeenCalledTimes(1);
    const again = await runner.run(aiSmokeTask, { caso: 'cache-e2e' }, { bypassCache: true });
    expect(again.ok).toBe(true);
    expect(ctx.completeSpy).toHaveBeenCalledTimes(2);
  });

  it('(c) 20 reservas concurrentes contra Postgres con un tope que admite 7: exactamente 7', async () => {
    const repository = ctx.app.get<AiBudgetRepository>(AI_BUDGET_REPOSITORY);
    const amount = 1_000_000;
    const cap = 7 * amount + 500_000; // admite 7 y sobra medio USD (no alcanza para un octavo)
    const guard = new BudgetGuard(
      repository,
      { capMicroUsd: cap, requestTimeoutMs: 60_000 },
      systemClock,
    );
    const month = '2099-01';
    const now = new Date();
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        guard.reserve(
          {
            id: randomUUID(),
            task: 'ai.e2e',
            promptVersion: 1,
            model: 'claude-haiku-5-5',
            inputHash: 'h',
            cacheKey: 'k',
            budgetMonth: month,
            now,
          },
          amount,
        ),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(7);
    const row = await ctx.prisma.aiBudgetMonth.findUniqueOrThrow({ where: { month } });
    expect(row.reservedMicroUsd).toBe(7 * amount);
    expect(row.spentMicroUsd + row.reservedMicroUsd).toBeLessThanOrEqual(cap);
    expect(
      await ctx.prisma.aiRun.count({ where: { budgetMonth: month, status: 'RESERVED' } }),
    ).toBe(7);
  });

  it('(c) conciliar libera la reserva y suma el costo real, una sola vez', async () => {
    const repository = ctx.app.get<AiBudgetRepository>(AI_BUDGET_REPOSITORY);
    const guard = new BudgetGuard(
      repository,
      { capMicroUsd: 10_000_000, requestTimeoutMs: 60_000 },
      systemClock,
    );
    const now = new Date();
    const reserved = await guard.reserve(
      {
        id: randomUUID(),
        task: 'ai.e2e',
        promptVersion: 1,
        model: 'claude-haiku-5-5',
        inputHash: 'h',
        cacheKey: 'k',
        budgetMonth: '2099-02',
        now,
      },
      900,
    );
    if (!reserved.ok) throw new Error('se esperaba ok');
    const closed = await guard.settle(reserved.value, {
      status: 'SUCCEEDED',
      costMicroUsd: 120,
      durationMs: 5,
      finishedAt: now,
    });
    expect(closed.status).toBe('SUCCEEDED');
    let row = await ctx.prisma.aiBudgetMonth.findUniqueOrThrow({ where: { month: '2099-02' } });
    expect(row).toMatchObject({ reservedMicroUsd: 0, spentMicroUsd: 120 });
    // Una segunda conciliación de la misma corrida no duplica el cargo.
    expect(
      await repository.settle({
        run: closed,
        month: '2099-02',
        releasedMicroUsd: 900,
        chargedMicroUsd: 120,
      }),
    ).toBe(false);
    row = await ctx.prisma.aiBudgetMonth.findUniqueOrThrow({ where: { month: '2099-02' } });
    expect(row.spentMicroUsd).toBe(120);
  });

  it('(g) una reserva huérfana vencida pasa a ABANDONED con su reserva imputada antes de evaluar la nueva', async () => {
    const repository = ctx.app.get<AiBudgetRepository>(AI_BUDGET_REPOSITORY);
    const now = new Date();
    const month = budgetMonthOf(now);
    const orphan = AiRun.reserved(
      {
        id: randomUUID(),
        task: 'ai.smoke',
        promptVersion: 1,
        model: 'claude-haiku-5-5',
        inputHash: 'h',
        cacheKey: 'k-huerfana',
        budgetMonth: month,
        now: new Date(now.getTime() - 3_600_000),
      },
      700,
      new Date(now.getTime() - 60_000),
    );
    await repository.reserve({ run: orphan, month, capMicroUsd: 10_000_000, now });
    expect(
      (await ctx.prisma.aiBudgetMonth.findUniqueOrThrow({ where: { month } })).reservedMicroUsd,
    ).toBe(700);

    const res = await authed(ctx, cookie).post(SMOKE);
    expect(res.status).toBe(201);
    const abandoned = await ctx.prisma.aiRun.findUniqueOrThrow({ where: { id: orphan.id } });
    expect(abandoned.status).toBe('ABANDONED');
    expect(abandoned.costMicroUsd).toBe(700);
    const row = await ctx.prisma.aiBudgetMonth.findUniqueOrThrow({ where: { month } });
    expect(row.reservedMicroUsd).toBe(0);
    expect(row.spentMicroUsd).toBe(700 + 45);
  });

  it('(i) ningún payload enviado contiene el email del perfil ni el secreto del JWT', async () => {
    // Por el runner y no por HTTP: la prueba de conexión tiene su propio límite de 5 por minuto.
    await ctx.app.get<AiTaskRunner>(AI_TASK_RUNNER).run(aiSmokeTask, { caso: 'espia' });
    const profile = await ctx.prisma.profile.findFirst();
    const sent = JSON.stringify(
      [...ctx.completeSpy.mock.calls, ...ctx.countSpy.mock.calls].map((call) => {
        const req = call[0] as { system: string; user: string };
        return { system: req.system, user: req.user };
      }),
    );
    expect(sent.length).toBeGreaterThan(10);
    if (profile?.email) expect(sent).not.toContain(profile.email);
    expect(sent).not.toContain(process.env.JWT_SECRET ?? 'no-hay-secreto');
  });

  it('un dato prohibido en una tarea se bloquea sin llamar al adaptador (BLOCKED)', async () => {
    const runner = ctx.app.get<AiTaskRunner>(AI_TASK_RUNNER);
    const leaky = {
      ...aiSmokeTask,
      id: 'ai.fuga',
      buildInput: () => ({ structured: { contacto: 'alex.rivera@example.com' }, freeText: {} }),
    };
    const result = await runner.run(leaky, undefined);
    expect(result.ok).toBe(false);
    expect(ctx.completeSpy).not.toHaveBeenCalled();
    expect(ctx.countSpy).not.toHaveBeenCalled();
    const run = await ctx.prisma.aiRun.findFirstOrThrow({ where: { task: 'ai.fuga' } });
    expect(run).toMatchObject({ status: 'BLOCKED', failureKind: 'ForbiddenData', costMicroUsd: 0 });
  });

  it('el estado cerca del tope se refleja en el uso', async () => {
    await ctx.prisma.aiBudgetMonth.create({
      data: { month: budgetMonthOf(new Date()), spentMicroUsd: 8_100_000 },
    });
    const usage = await authed(ctx, cookie).get(USAGE);
    expect(usage.body).toMatchObject({ state: 'NEAR_LIMIT', remainingUsd: 1.9, percentUsed: 81 });
  });
});

describe('IA con tope 0 (e2e)', () => {
  let ctx: AiTestApp;
  let cookie: string;

  beforeAll(async () => {
    ctx = await createAiApp({
      AI_ENABLED: 'true',
      AI_PROVIDER: 'fake',
      AI_MONTHLY_BUDGET_USD: '0',
    });
    await createE2eAdmin(ctx.prisma);
    cookie = await loginCookie(ctx.app);
  });
  beforeEach(() => cleanAi(ctx.prisma));
  afterAll(async () => {
    await cleanAi(ctx.prisma);
    await deleteE2eAdmin(ctx.prisma);
    await ctx.close();
  });

  it('(d) el humo responde 422 sin llamar al adaptador y el estado es EXHAUSTED', async () => {
    const res = await authed(ctx, cookie).post(SMOKE);
    expect(res.status).toBe(422);
    expect(res.body.message).toBe('Se alcanzó el tope de IA del mes');
    expect(ctx.completeSpy).not.toHaveBeenCalled();
    const usage = await authed(ctx, cookie).get(USAGE);
    expect(usage.body).toMatchObject({ state: 'EXHAUSTED', budgetUsd: 0, remainingUsd: 0 });
    expect(await ctx.prisma.aiRun.count({ where: { status: 'BLOCKED' } })).toBe(1);
  });
});

describe('Límite de la prueba de conexión (e2e)', () => {
  it('permite 5 por minuto y la sexta responde 429', async () => {
    const ctx = await createAiApp({
      AI_ENABLED: 'true',
      AI_PROVIDER: 'fake',
      AI_MONTHLY_BUDGET_USD: '0',
    });
    try {
      await createE2eAdmin(ctx.prisma);
      const cookie = await loginCookie(ctx.app);
      const statuses: number[] = [];
      for (let i = 0; i < 6; i += 1) statuses.push((await authed(ctx, cookie).post(SMOKE)).status);
      // Con tope 0 cada una responde 422; la sexta ya no entra: la corta el límite.
      expect(statuses).toEqual([422, 422, 422, 422, 422, 429]);
    } finally {
      await cleanAi(ctx.prisma);
      await deleteE2eAdmin(ctx.prisma);
      await ctx.close();
    }
  });
});

describe('IA con el spend limit del proveedor (e2e)', () => {
  const cases = [
    ['spend-limit-tier', 'el tope del tier bloquea hasta el día 1 del mes siguiente'],
    ['spend-limit-console', 'el límite de la Console bloquea una hora'],
  ] as const;

  it.each(cases)('(e) %s: %s y el humo siguiente no llama al adaptador', async (scenario) => {
    const ctx = await createAiApp({
      AI_ENABLED: 'true',
      AI_PROVIDER: 'fake',
      AI_FAKE_SCENARIO: scenario,
    });
    try {
      await createE2eAdmin(ctx.prisma);
      await cleanAi(ctx.prisma);
      const cookie = await loginCookie(ctx.app);

      const first = await authed(ctx, cookie).post(SMOKE);
      expect(first.status).toBe(201);
      expect(first.body).toMatchObject({ status: 'FAILED', failureKind: 'BudgetExhausted' });
      expect(ctx.completeSpy).toHaveBeenCalledTimes(1);

      const usage = await authed(ctx, cookie).get(USAGE);
      expect(usage.body.state).toBe('PROVIDER_BLOCKED');
      const until = new Date(usage.body.providerBlockedUntil as string);
      if (scenario === 'spend-limit-tier') {
        expect(until.getUTCDate()).toBe(1);
        expect(until.getUTCHours()).toBe(0);
        expect(until.getTime()).toBeGreaterThan(Date.now());
      } else {
        expect(until.getTime() - Date.now()).toBeGreaterThan(50 * 60_000);
        expect(until.getTime() - Date.now()).toBeLessThanOrEqual(60 * 60_000);
      }

      const second = await authed(ctx, cookie).post(SMOKE);
      expect(second.status).toBe(422);
      expect(second.body.message).toContain('Anthropic cortó por el spend limit');
      expect(ctx.completeSpy).toHaveBeenCalledTimes(1);
      expect(await ctx.prisma.aiRun.count({ where: { status: 'BLOCKED' } })).toBe(1);
    } finally {
      await cleanAi(ctx.prisma);
      await deleteE2eAdmin(ctx.prisma);
      await ctx.close();
    }
  });
});

describe('IA lenta y la ruta pública (e2e)', () => {
  it('(f) con el escenario slow, el perfil público responde en menos de 500 ms y el humo termina FAILED con la reserva imputada', async () => {
    const ctx = await createAiApp({
      AI_ENABLED: 'true',
      AI_PROVIDER: 'fake',
      AI_FAKE_SCENARIO: 'slow',
      AI_REQUEST_TIMEOUT_MS: '5000',
    });
    try {
      await createE2eAdmin(ctx.prisma);
      await cleanAi(ctx.prisma);
      const cookie = await loginCookie(ctx.app);

      const smoke = authed(ctx, cookie)
        .post(SMOKE)
        .then((res) => res);
      // Espera a que el adaptador haya recibido la llamada (la reserva ya está hecha).
      while (ctx.completeSpy.mock.calls.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      const started = Date.now();
      const profile = await request(ctx.app.getHttpServer()).get('/api/curated-profiles/all');
      const elapsed = Date.now() - started;
      expect(profile.status).toBe(200);
      expect(elapsed).toBeLessThan(500);

      const res = await smoke;
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ status: 'FAILED', failureKind: 'Transient' });
      const run = await ctx.prisma.aiRun.findFirstOrThrow();
      expect(run.costMicroUsd).toBe(run.reservedMicroUsd);
      expect(run.reservedMicroUsd).toBeGreaterThan(0);
      const month = await ctx.prisma.aiBudgetMonth.findFirstOrThrow();
      expect(month).toMatchObject({ reservedMicroUsd: 0, spentMicroUsd: run.reservedMicroUsd });
    } finally {
      await cleanAi(ctx.prisma);
      await deleteE2eAdmin(ctx.prisma);
      await ctx.close();
    }
  }, 20_000);
});

describe('IA apagada (e2e)', () => {
  let ctx: AiTestApp;
  let cookie: string;

  beforeAll(async () => {
    // Sin ninguna variable AI_*: el default.
    ctx = await createAiApp({});
    await createE2eAdmin(ctx.prisma);
    cookie = await loginCookie(ctx.app);
  });
  beforeEach(() => cleanAi(ctx.prisma));
  afterAll(async () => {
    await cleanAi(ctx.prisma);
    await deleteE2eAdmin(ctx.prisma);
    await ctx.close();
  });

  it('(j) la factory del cliente de Anthropic nunca se invoca y el uso responde DISABLED', async () => {
    expect(ctx.clientFactory).not.toHaveBeenCalled();
    const usage = await authed(ctx, cookie).get(USAGE);
    expect(usage.status).toBe(200);
    expect(usage.body).toMatchObject({
      enabled: false,
      state: 'DISABLED',
      budgetUsd: 10,
      recentRuns: [],
    });
  });

  it('el humo responde 422 «La IA está apagada en este servidor» y no crea ninguna corrida', async () => {
    const res = await authed(ctx, cookie).post(SMOKE);
    expect(res.status).toBe(422);
    expect(res.body.message).toBe('La IA está apagada en este servidor');
    expect(await ctx.prisma.aiRun.count()).toBe(0);
    expect(ctx.clientFactory).not.toHaveBeenCalled();
  });

  it('el resto de la API se comporta igual: el perfil público responde', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/api/curated-profiles/all');
    expect(res.status).toBe(200);
  });
});
