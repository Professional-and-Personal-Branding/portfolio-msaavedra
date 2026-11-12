/**
 * E2E — API del panel de integraciones (change `add-integrations-foundation`, D3, D14, D18):
 * sesión, «Sincronizar ahora» que solo encola, pausa, credencial de solo escritura y `stale`.
 */
import request from 'supertest';
import { RunDueJobsUseCase } from '../src/modules/integrations/application/use-cases/run-due-jobs.use-case';
import {
  cleanIntegrations,
  createIntegrationsApp,
  IntegrationsTestApp,
  TEST_FAKE_TOKEN,
} from './integrations-helpers';
import { createE2eAdmin, deleteE2eAdmin, loginCookie } from './e2e-helpers';

const HOUR = 3_600_000;
const BASE = '/api/admin/integrations';

describe('API de integraciones del panel (e2e)', () => {
  let ctx: IntegrationsTestApp;
  let cookie: string;

  const http = () => request(ctx.app.getHttpServer());
  const authed = {
    get: (url: string) => http().get(url).set('Cookie', cookie),
    post: (url: string) => http().post(url).set('Cookie', cookie),
    patch: (url: string) => http().patch(url).set('Cookie', cookie),
    put: (url: string) => http().put(url).set('Cookie', cookie),
    delete: (url: string) => http().delete(url).set('Cookie', cookie),
  };

  beforeAll(async () => {
    ctx = await createIntegrationsApp();
    await createE2eAdmin(ctx.prisma);
    cookie = await loginCookie(ctx.app);
  });

  beforeEach(async () => {
    await cleanIntegrations(ctx.prisma);
    ctx.fake.resetCalls();
    process.env.FAKE_PROVIDER_TOKEN = TEST_FAKE_TOKEN;
  });

  afterAll(async () => {
    await cleanIntegrations(ctx.prisma);
    await deleteE2eAdmin(ctx.prisma);
    await ctx.close();
  });

  it('las cinco rutas exigen sesión (401)', async () => {
    const responses = await Promise.all([
      http().get(BASE),
      http().post(`${BASE}/fake/sync`),
      http().patch(`${BASE}/fake`).send({ enabled: false }),
      http().put(`${BASE}/fake/credential`).send({ secret: 'x' }),
      http().delete(`${BASE}/fake/credential`),
    ]);
    expect(responses.map((r) => r.status)).toEqual([401, 401, 401, 401, 401]);
  });

  it('GET devuelve schedulerEnabled: false y el estado de fake, sin secretos', async () => {
    const res = await authed.get(BASE);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.schedulerEnabled).toBe(false);
    expect(res.body.providers).toHaveLength(1);
    expect(res.body.providers[0]).toMatchObject({
      provider: 'fake',
      enabled: true,
      stale: false,
      pausedUntil: null,
      lastRun: null,
      jobs: { pending: 0, running: 0, failed: 0, dead: 0 },
      credential: { source: 'env' },
    });
    expect(JSON.stringify(res.body)).not.toContain(TEST_FAKE_TOKEN);
  });

  it('POST …/sync responde 202, no llama al conector y el segundo clic devuelve el mismo trabajo', async () => {
    const first = await authed.post(`${BASE}/fake/sync`);
    expect(first.status).toBe(202);
    expect(first.headers['cache-control']).toBe('no-store');
    expect(first.body).toMatchObject({ status: 'PENDING', alreadyQueued: false });
    expect(ctx.fake.totalCalls).toBe(0);

    const second = await authed.post(`${BASE}/fake/sync`);
    expect(second.status).toBe(202);
    expect(second.body).toMatchObject({ jobId: first.body.jobId, alreadyQueued: true });
    expect(ctx.fake.totalCalls).toBe(0);

    const status = await authed.get(BASE);
    expect(status.body.providers[0].jobs.pending).toBe(1);

    // El conector se llama solo cuando corre el ejecutor (el «próximo tick»).
    await ctx.app.get(RunDueJobsUseCase).execute();
    expect(ctx.fake.totalCalls).toBe(1);
    const after = await authed.get(BASE);
    expect(after.body.providers[0]).toMatchObject({
      jobs: { pending: 0 },
      lastRun: { outcome: 'SUCCESS' },
    });
    expect(after.body.providers[0].lastSuccessAt).not.toBeNull();
  });

  it('PATCH enabled:false pausa (200) y POST …/sync da 422; reanudar lo habilita', async () => {
    const paused = await authed.patch(`${BASE}/fake`).send({ enabled: false });
    expect(paused.status).toBe(200);
    expect(paused.body.enabled).toBe(false);

    const blocked = await authed.post(`${BASE}/fake/sync`);
    expect(blocked.status).toBe(422);
    expect(await ctx.prisma.integrationJob.count({ where: { provider: 'fake' } })).toBe(0);

    const resumed = await authed.patch(`${BASE}/fake`).send({ enabled: true });
    expect(resumed.body.enabled).toBe(true);
    expect((await authed.post(`${BASE}/fake/sync`)).status).toBe(202);
  });

  it('un proveedor fuera de INTEGRATIONS_ENABLED da 404 en todas las rutas', async () => {
    const responses = await Promise.all([
      authed.post(`${BASE}/github/sync`),
      authed.patch(`${BASE}/github`).send({ enabled: false }),
      authed.put(`${BASE}/github/credential`).send({ secret: 'x' }),
      authed.delete(`${BASE}/github/credential`),
    ]);
    expect(responses.map((r) => r.status)).toEqual([404, 404, 404, 404]);
  });

  describe('credencial', () => {
    const SECRET = 'credencial-guardada-en-la-base-123';

    it('con la variable de entorno definida el origen es env y el PUT da 422', async () => {
      const status = await authed.get(BASE);
      expect(status.body.providers[0].credential.source).toBe('env');
      const put = await authed.put(`${BASE}/fake/credential`).send({ secret: SECRET });
      expect(put.status).toBe(422);
      expect(await ctx.prisma.integrationCredential.count()).toBe(0);
    });

    it('sin la variable: PUT 204, GET source db sin el valor, el ejecutor la usa y DELETE 204', async () => {
      delete process.env.FAKE_PROVIDER_TOKEN;

      const put = await authed.put(`${BASE}/fake/credential`).send({ secret: SECRET });
      expect(put.status).toBe(204);
      expect(put.headers['cache-control']).toBe('no-store');

      const status = await authed.get(BASE);
      expect(status.body.providers[0].credential).toMatchObject({ source: 'db', keyId: 'k1' });
      expect(JSON.stringify(status.body)).not.toContain(SECRET);
      const stored = await ctx.prisma.integrationCredential.findUniqueOrThrow({
        where: { provider: 'fake' },
      });
      expect(stored.ciphertext).not.toContain(SECRET);

      // El secreto de la base llega al conector (el escenario leak-secret lo devuelve en el error).
      await ctx.prisma.integrationJob.create({
        data: {
          provider: 'fake',
          kind: 'sync',
          idempotencyKey: 'admin:cred',
          payload: { scenario: 'ok' },
          runAt: new Date(Date.now() - 1000),
        },
      });
      await ctx.app.get(RunDueJobsUseCase).execute();
      const run = await ctx.prisma.syncRun.findFirstOrThrow({ where: { provider: 'fake' } });
      expect(run.outcome).toBe('SUCCESS');

      expect((await authed.delete(`${BASE}/fake/credential`)).status).toBe(204);
      const after = await authed.get(BASE);
      expect(after.body.providers[0].credential).toMatchObject({ source: null, keyId: null });
      // Idempotente.
      expect((await authed.delete(`${BASE}/fake/credential`)).status).toBe(204);
    });

    it('sin credencial alguna, el trabajo termina DEAD con «falta la credencial»', async () => {
      delete process.env.FAKE_PROVIDER_TOKEN;
      await authed.post(`${BASE}/fake/sync`);
      await ctx.app.get(RunDueJobsUseCase).execute();
      const job = await ctx.prisma.integrationJob.findFirstOrThrow({ where: { provider: 'fake' } });
      expect(job.status).toBe('DEAD');
      expect(job.lastError).toBe('falta la credencial');
      const status = await authed.get(BASE);
      expect(status.body.providers[0]).toMatchObject({
        jobs: { dead: 1 },
        lastDeadError: 'falta la credencial',
      });
    });

    it.each([
      ['vacío', { secret: '' }],
      ['ausente', {}],
      ['más de 4096', { secret: 'x'.repeat(4097) }],
      ['con espacios al borde', { secret: ' con-espacio' }],
      ['campo desconocido', { secret: 'ok', extra: 1 }],
      ['tipo inválido', { secret: 123 }],
    ])('rechaza el cuerpo %s con 400', async (_name, body) => {
      delete process.env.FAKE_PROVIDER_TOKEN;
      const res = await authed.put(`${BASE}/fake/credential`).send(body);
      expect(res.status).toBe(400);
      expect(await ctx.prisma.integrationCredential.count()).toBe(0);
    });

    it('acepta exactamente 4096 caracteres', async () => {
      delete process.env.FAKE_PROVIDER_TOKEN;
      const res = await authed.put(`${BASE}/fake/credential`).send({ secret: 'x'.repeat(4096) });
      expect(res.status).toBe(204);
    });
  });

  it('PATCH con un campo desconocido o sin enabled da 400', async () => {
    expect((await authed.patch(`${BASE}/fake`).send({ enabled: true, otro: 1 })).status).toBe(400);
    expect((await authed.patch(`${BASE}/fake`).send({})).status).toBe(400);
    expect((await authed.patch(`${BASE}/fake`).send({ enabled: 'si' })).status).toBe(400);
  });

  it('stale: true con la última corrida exitosa de hace 49 h, y false con 47 h', async () => {
    await ctx.prisma.integrationSetting.create({
      data: {
        provider: 'fake',
        lastSuccessAt: new Date(Date.now() - 49 * HOUR),
        enabledSince: new Date(Date.now() - 100 * HOUR),
      },
    });
    expect((await authed.get(BASE)).body.providers[0].stale).toBe(true);
    await ctx.prisma.integrationSetting.update({
      where: { provider: 'fake' },
      data: { lastSuccessAt: new Date(Date.now() - 47 * HOUR) },
    });
    expect((await authed.get(BASE)).body.providers[0].stale).toBe(false);
  });

  it('una pausa por el tercero se informa con su motivo y vence sola', async () => {
    await ctx.prisma.integrationSetting.create({
      data: {
        provider: 'fake',
        pausedUntil: new Date(Date.now() + HOUR),
        pauseReason: 'RetryAfter',
      },
    });
    const paused = (await authed.get(BASE)).body.providers[0];
    expect(paused.pauseReason).toBe('RetryAfter');
    expect(paused.pausedUntil).not.toBeNull();
    await ctx.prisma.integrationSetting.update({
      where: { provider: 'fake' },
      data: { pausedUntil: new Date(Date.now() - 1000) },
    });
    expect((await authed.get(BASE)).body.providers[0].pausedUntil).toBeNull();
  });
});
