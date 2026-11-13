/**
 * E2E — redacción y trazabilidad (change `add-integrations-foundation`, D16, spec
 * `api-observability`): el token y la credencial no salen en logs, filas ni respuestas, y todas
 * las líneas de un trabajo llevan el `syncRunId` de su fila `SyncRun`.
 */
import request from 'supertest';
import { RunDueJobsUseCase } from '../src/modules/integrations/application/use-cases/run-due-jobs.use-case';
import {
  addJob,
  cleanIntegrations,
  createIntegrationsApp,
  IntegrationsTestApp,
  TEST_FAKE_TOKEN,
} from './integrations-helpers';
import { createE2eAdmin, deleteE2eAdmin, loginCookie } from './e2e-helpers';

describe('Redacción de las integraciones (e2e)', () => {
  let ctx: IntegrationsTestApp;
  let cookie: string;

  beforeAll(async () => {
    ctx = await createIntegrationsApp({ secretFromEnv: false });
    await createE2eAdmin(ctx.prisma);
    cookie = await loginCookie(ctx.app);
  });

  beforeEach(async () => {
    await cleanIntegrations(ctx.prisma);
    process.env.FAKE_PROVIDER_TOKEN = TEST_FAKE_TOKEN;
  });

  afterAll(async () => {
    await cleanIntegrations(ctx.prisma);
    await deleteE2eAdmin(ctx.prisma);
    await ctx.close();
  });

  it('leak-secret: ni el log, ni SyncRun.errorMessage, ni IntegrationJob.lastError, ni la API contienen el token', async () => {
    const job = await addJob(ctx.prisma, { key: 'red:1', payload: { scenario: 'leak-secret' } });

    await ctx.app.get(RunDueJobsUseCase).execute();

    const logs = ctx.logLines().join('\n');
    expect(logs).toContain('[Redacted]');
    expect(logs).not.toContain(TEST_FAKE_TOKEN);

    const row = await ctx.prisma.integrationJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(row.lastError).toContain('[Redacted]');
    expect(row.lastError).not.toContain(TEST_FAKE_TOKEN);
    const run = await ctx.prisma.syncRun.findFirstOrThrow({ where: { jobId: job.id } });
    expect(run.errorMessage).not.toContain(TEST_FAKE_TOKEN);

    const res = await request(ctx.app.getHttpServer())
      .get('/api/admin/integrations')
      .set('Cookie', cookie);
    expect(JSON.stringify(res.body)).not.toContain(TEST_FAKE_TOKEN);
    expect(res.body.providers[0].lastRun.errorMessage).toContain('[Redacted]');
  });

  it('guardar una credencial: ni los logs ni las respuestas contienen el secreto', async () => {
    const SECRET = 'credencial-secreta-e2e-987654';
    delete process.env.FAKE_PROVIDER_TOKEN;

    const put = await request(ctx.app.getHttpServer())
      .put('/api/admin/integrations/fake/credential')
      .set('Cookie', cookie)
      .send({ secret: SECRET });
    expect(put.status).toBe(204);
    expect(JSON.stringify(put.body)).not.toContain(SECRET);

    // Corre un trabajo con esa credencial y un fallo que la filtra.
    await addJob(ctx.prisma, { key: 'red:2', payload: { scenario: 'leak-secret' } });
    await ctx.app.get(RunDueJobsUseCase).execute();

    const logs = ctx.logLines().join('\n');
    expect(logs).toContain('Credencial de integración guardada');
    expect(logs).not.toContain(SECRET);
    const run = await ctx.prisma.syncRun.findFirstOrThrow({ where: { provider: 'fake' } });
    expect(run.errorMessage).not.toContain(SECRET);
    expect(run.errorMessage).toContain('[Redacted]');
  });

  it('todas las líneas del trabajo llevan el syncRunId de su fila, el jobId y el provider', async () => {
    const job = await addJob(ctx.prisma, { key: 'red:3', payload: { scenario: 'transient' } });

    await ctx.app.get(RunDueJobsUseCase).execute();

    const run = await ctx.prisma.syncRun.findFirstOrThrow({ where: { jobId: job.id } });
    const lines = ctx
      .logLines()
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter((entry) => entry.jobId === job.id);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    for (const entry of lines) {
      expect(entry).toMatchObject({ syncRunId: run.id, jobId: job.id, provider: 'fake' });
    }
  });
});
