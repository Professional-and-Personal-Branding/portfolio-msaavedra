/**
 * E2E — evidencia de código verificada contra GitHub (change `add-github-code-evidence`), SIN red:
 * `INTEGRATIONS_ENABLED=github` con `GITHUB_TRANSPORT=fixture` y la corrida invocada directamente
 * (como los e2e de la base). Ningún token real: el de esta corrida se genera al azar.
 */
import { randomBytes } from 'crypto';
import request from 'supertest';
import { GITHUB_API } from '../src/modules/integrations/application/github/github-api.port';
import { RunDueJobsUseCase } from '../src/modules/integrations/application/use-cases/run-due-jobs.use-case';
import { transient } from '../src/modules/integrations/domain/provider-failure';
import {
  FIXTURE_INVALID_TOKEN,
  FixtureGithubTransport,
} from '../src/modules/integrations/infrastructure/providers/github/fixture-github-transport';
import { fail } from '../src/shared/domain/result';
import { createE2eAdmin, deleteE2eAdmin, loginCookie, settleBackgroundTasks } from './e2e-helpers';
import { createIntegrationsApp, IntegrationsTestApp } from './integrations-helpers';

const OWNER = 'portafolio-ejemplo-ficticio';
const URL_OF = (repo: string): string => `https://github.com/${OWNER}/${repo}`;
const TEST_TOKEN = `tok_${randomBytes(18).toString('hex')}`;

interface PublicRepository {
  name: string;
  language: string | null;
  evidence: {
    stars: number;
    languages: Array<{ name: string; percent: number }>;
    topics: string[];
    archived: boolean;
    verifiedAt: string;
    pushedAt: string | null;
  } | null;
}

describe('Evidencia de código de GitHub (e2e, transporte de fixtures)', () => {
  let ctx: IntegrationsTestApp;
  let transport: FixtureGithubTransport;
  let cookie: string;
  let jobSeq = 0;
  const previousToken = process.env.GITHUB_SYNC_TOKEN;

  const http = () => request(ctx.app.getHttpServer());

  async function seedRepositories(): Promise<void> {
    const base = {
      description: { es: 'Descripción de prueba', en: 'Test description' },
      tags: [] as string[],
    };
    await ctx.prisma.featuredRepository.createMany({
      data: [
        {
          ...base,
          name: 'reservas-api',
          url: URL_OF('reservas-api'),
          language: null,
          technologies: ['Spring Boot', 'Docker'],
          order: 0,
        },
        {
          ...base,
          name: 'metricas-dashboard',
          url: URL_OF('metricas-dashboard'),
          language: 'TypeScript',
          technologies: ['React'],
          order: 1,
        },
        {
          ...base,
          name: 'private-repo',
          url: URL_OF('private-repo'),
          language: null,
          technologies: [],
          order: 2,
        },
        {
          ...base,
          name: 'experimento-oculto',
          url: URL_OF('experimento-oculto'),
          language: null,
          technologies: [],
          order: 3,
          visible: false,
        },
      ],
    });
  }

  /** Encola un trabajo `github` con clave propia y corre el ejecutor una vez. */
  async function runSync(): Promise<{
    status: string;
    lastError: string | null;
    changed: number | null;
  }> {
    jobSeq += 1;
    const job = await ctx.prisma.integrationJob.create({
      data: {
        provider: 'github',
        kind: 'sync',
        idempotencyKey: `e2e-github:${jobSeq}`,
        payload: {},
        status: 'PENDING',
        runAt: new Date(Date.now() - 1000),
      },
    });
    await ctx.app.get(RunDueJobsUseCase).execute();
    const row = await ctx.prisma.integrationJob.findUniqueOrThrow({ where: { id: job.id } });
    const run = await ctx.prisma.syncRun.findFirst({
      where: { jobId: job.id },
      orderBy: { startedAt: 'desc' },
    });
    return { status: row.status, lastError: row.lastError, changed: run?.itemsChanged ?? null };
  }

  const publicRepositories = async (): Promise<PublicRepository[]> =>
    (await http().get('/api/featured-repositories')).body as PublicRepository[];

  const byName = (list: PublicRepository[], name: string): PublicRepository | undefined =>
    list.find((repository) => repository.name === name);

  async function cleanAll(): Promise<void> {
    await ctx.prisma.featuredRepository.deleteMany({
      where: { url: { startsWith: `https://github.com/${OWNER}/` } },
    });
    await ctx.prisma.integrationJob.deleteMany({ where: { provider: 'github' } });
    await ctx.prisma.syncRun.deleteMany({ where: { provider: 'github' } });
    await ctx.prisma.integrationSetting.deleteMany({ where: { provider: 'github' } });
    await ctx.prisma.integrationCredential.deleteMany({ where: { provider: 'github' } });
    await ctx.prisma.externalSnapshot.deleteMany({ where: { provider: 'github' } });
    await ctx.prisma
      .$executeRaw`UPDATE "IntegrationRunnerLease" SET holder = '', "expiresAt" = TIMESTAMP '1970-01-01 00:00:00' WHERE id = 'runner'`;
  }

  beforeAll(async () => {
    ctx = await createIntegrationsApp({
      secretFromEnv: false,
      extra: { INTEGRATIONS_ENABLED: 'github', GITHUB_TRANSPORT: 'fixture' },
    });
    transport = ctx.app.get<FixtureGithubTransport>(GITHUB_API);
    await createE2eAdmin(ctx.prisma);
    cookie = await loginCookie(ctx.app);
  });

  beforeEach(async () => {
    await cleanAll();
    await seedRepositories();
    process.env.GITHUB_SYNC_TOKEN = TEST_TOKEN;
    transport.resetRecording();
  });

  afterAll(async () => {
    await cleanAll();
    await deleteE2eAdmin(ctx.prisma);
    if (previousToken === undefined) delete process.env.GITHUB_SYNC_TOKEN;
    else process.env.GITHUB_SYNC_TOKEN = previousToken;
    await ctx.close();
  });

  it('el arranque usa el transporte de fixtures', () => {
    expect(transport).toBeInstanceOf(FixtureGithubTransport);
  });

  it('(a) sin sincronizar, las tarjetas quedan como antes: evidence null y el lenguaje manual', async () => {
    const list = await publicRepositories();
    expect(list.map((r) => r.name)).toEqual(['reservas-api', 'metricas-dashboard', 'private-repo']);
    expect(list.every((r) => r.evidence === null)).toBe(true);
    expect(byName(list, 'reservas-api')?.language).toBeNull();
  });

  it('(a) la primera corrida actualiza stars, lenguajes y topics en el listado y en el perfil curado', async () => {
    const result = await runSync();
    expect(result.status).toBe('DONE');
    expect(result.changed).toBe(4);

    const reservas = byName(await publicRepositories(), 'reservas-api');
    expect(reservas?.evidence).toMatchObject({
      stars: 12,
      archived: false,
      languages: [
        { name: 'Java', percent: 92 },
        { name: 'HTML', percent: 6 },
        { name: 'Dockerfile', percent: 2 },
      ],
      // «docker» no es un topic de este fixture; los topics no repiten «Spring Boot».
      topics: ['api-rest', 'postgresql', 'reservas'],
    });
    expect(reservas?.evidence?.pushedAt).toBe('2026-11-02T14:20:00.000Z');
    // Sin lenguaje manual, el efectivo es el principal de GitHub.
    expect(reservas?.language).toBe('Java');
    // Con lenguaje manual, el manual manda.
    const metricas = byName(await publicRepositories(), 'metricas-dashboard');
    expect(metricas?.language).toBe('TypeScript');
    expect(metricas?.evidence).toMatchObject({ stars: 0, archived: true });

    const profile = await http().get('/api/curated-profiles/all');
    expect(profile.status).toBe(200);
    const inProfile = (profile.body.repositories as PublicRepository[]).find(
      (r) => r.name === 'reservas-api',
    );
    expect(inProfile?.evidence?.stars).toBe(12);
    expect(inProfile?.language).toBe('Java');
  });

  it('(b) la segunda corrida recibe 304 en todo: 0 cambios, datos idénticos y verifiedAt posterior', async () => {
    await runSync();
    const before = await ctx.prisma.repositoryEvidence.findMany({ orderBy: { repoKey: 'asc' } });
    const snapshotsBefore = await ctx.prisma.externalSnapshot.findMany({
      where: { provider: 'github' },
      orderBy: { resourceKey: 'asc' },
    });
    transport.resetRecording();
    await new Promise((resolve) => setTimeout(resolve, 20));

    const result = await runSync();

    expect(result.status).toBe('DONE');
    expect(result.changed).toBe(0);
    // Todas las peticiones son condicionales y autorizadas; nunca hay dos a la vez.
    expect(transport.requests.length).toBeGreaterThan(0);
    expect(transport.requests.every((r) => r.hasAuthorization)).toBe(true);
    // Condicionales todas, salvo el repo privado: nunca se guarda su cuerpo, así que no tiene ETag.
    expect(transport.requests.filter((r) => !r.conditional).map((r) => r.path)).toEqual([
      `/repos/${OWNER}/private-repo`,
    ]);
    expect(transport.maxConcurrent).toBe(1);

    const after = await ctx.prisma.repositoryEvidence.findMany({ orderBy: { repoKey: 'asc' } });
    expect(after).toHaveLength(before.length);
    after.forEach((row, index) => {
      expect({ ...row, verifiedAt: null }).toEqual({ ...before[index], verifiedAt: null });
      expect(row.verifiedAt.getTime()).toBeGreaterThan(before[index].verifiedAt.getTime());
      expect(row.changedAt).toEqual(before[index].changedAt);
    });
    const snapshotsAfter = await ctx.prisma.externalSnapshot.findMany({
      where: { provider: 'github' },
      orderBy: { resourceKey: 'asc' },
    });
    snapshotsAfter.forEach((row, index) => {
      expect(row.contentHash).toBe(snapshotsBefore[index].contentHash);
      expect(row.body).toEqual(snapshotsBefore[index].body);
      expect(row.changedAt).toEqual(snapshotsBefore[index].changedAt);
      expect(row.fetchedAt.getTime()).toBeGreaterThan(snapshotsBefore[index].fetchedAt.getTime());
    });
  });

  it('(c) con el token vencido el trabajo queda DEAD, la evidencia no cambia y la ruta pública la sigue sirviendo', async () => {
    await runSync();
    const before = await ctx.prisma.repositoryEvidence.findMany({ orderBy: { repoKey: 'asc' } });
    process.env.GITHUB_SYNC_TOKEN = FIXTURE_INVALID_TOKEN;

    const result = await runSync();

    expect(result.status).toBe('DEAD');
    expect(result.lastError).toContain('GitHub rechazó el token (401)');
    expect(await ctx.prisma.repositoryEvidence.findMany({ orderBy: { repoKey: 'asc' } })).toEqual(
      before,
    );
    const reservas = byName(await publicRepositories(), 'reservas-api');
    expect(reservas?.evidence?.stars).toBe(12);

    // El panel lo ve en Integraciones.
    const overview = await http().get('/api/admin/integrations').set('Cookie', cookie);
    const github = (overview.body.providers as Array<Record<string, unknown>>).find(
      (provider) => provider.provider === 'github',
    );
    expect(github?.jobs).toMatchObject({ dead: 1 });
  });

  it('(d) la ruta pública, el JSON Resume y el listado no hacen ninguna petición al transporte', async () => {
    await runSync();
    transport.resetRecording();

    expect((await http().get('/api/curated-profiles/all')).status).toBe(200);
    expect((await http().get('/api/curated-profiles/all/resume.json')).status).toBe(200);
    expect((await http().get('/api/featured-repositories')).status).toBe(200);
    expect((await http().get('/api/featured-repositories?locale=en')).status).toBe(200);
    await settleBackgroundTasks(ctx.app);

    expect(transport.requests).toHaveLength(0);
  });

  it('(e) sincronizar no mueve el updatedAt de ningún perfil curado', async () => {
    const before = await ctx.prisma.curatedProfile.findMany({
      select: { id: true, updatedAt: true },
      orderBy: { id: 'asc' },
    });
    await runSync();
    const after = await ctx.prisma.curatedProfile.findMany({
      select: { id: true, updatedAt: true },
      orderBy: { id: 'asc' },
    });
    expect(after).toEqual(before);
  });

  it('(f) un repo privado queda PRIVATE: evidence null en público y el estado en el panel', async () => {
    await runSync();
    const priv = byName(await publicRepositories(), 'private-repo');
    expect(priv?.evidence).toBeNull();
    expect(priv?.language).toBeNull();

    const admin = await http().get('/api/admin/featured-repositories').set('Cookie', cookie);
    const row = (admin.body as Array<{ name: string; evidence: { status: string } | null }>).find(
      (r) => r.name === 'private-repo',
    );
    expect(row?.evidence?.status).toBe('PRIVATE');
    // Nada de su cuerpo quedó en los snapshots.
    expect(
      await ctx.prisma.externalSnapshot.count({
        where: { provider: 'github', resourceKey: { contains: 'private-repo' } },
      }),
    ).toBe(0);
  });

  it('el repo oculto también se verifica pero nunca se publica', async () => {
    await runSync();
    expect(await ctx.prisma.repositoryEvidence.count()).toBe(4);
    expect(byName(await publicRepositories(), 'experimento-oculto')).toBeUndefined();
  });

  it('el panel recibe la evidencia cruda con stale en false, y en true si cambia la URL', async () => {
    await runSync();
    const list = await http().get('/api/admin/featured-repositories').set('Cookie', cookie);
    const reservas = (list.body as Array<Record<string, unknown>>).find(
      (r) => r.name === 'reservas-api',
    );
    expect(reservas?.evidence).toMatchObject({
      status: 'OK',
      repoKey: `${OWNER}/reservas-api`,
      stars: 12,
      stale: false,
      githubDescription: expect.stringContaining('Spring Boot') as unknown,
    });

    const patched = await http()
      .patch(`/api/admin/featured-repositories/${String(reservas?.id)}`)
      .set('Cookie', cookie)
      .send({ url: URL_OF('metricas-dashboard-2') });
    expect(patched.status).toBe(200);
    expect(patched.body.evidence).toMatchObject({ stale: true });
    // Mientras no corra otra sincronización, la evidencia del repo anterior no se publica.
    expect(byName(await publicRepositories(), 'reservas-api')?.evidence).toBeNull();
  });

  it('(g) al borrar un repositorio su evidencia desaparece (cascada)', async () => {
    await runSync();
    const target = await ctx.prisma.featuredRepository.findFirstOrThrow({
      where: { name: 'reservas-api' },
    });
    expect(
      await ctx.prisma.repositoryEvidence.count({ where: { featuredRepositoryId: target.id } }),
    ).toBe(1);
    await ctx.prisma.featuredRepository.delete({ where: { id: target.id } });
    expect(
      await ctx.prisma.repositoryEvidence.count({ where: { featuredRepositoryId: target.id } }),
    ).toBe(0);
  });

  it('un repo sin carpeta de fixture queda NOT_FOUND y no frena a los demás', async () => {
    await ctx.prisma.featuredRepository.create({
      data: {
        name: 'borrado',
        url: URL_OF('borrado-en-github'),
        description: { es: 'x', en: 'x' },
        technologies: [],
        tags: [],
        order: -1,
      },
    });
    const result = await runSync();
    expect(result.status).toBe('DONE');
    const gone = await ctx.prisma.repositoryEvidence.findFirstOrThrow({
      where: { repoKey: `${OWNER}/borrado-en-github` },
    });
    expect(gone.status).toBe('NOT_FOUND');
    expect(byName(await publicRepositories(), 'reservas-api')?.evidence?.stars).toBe(12);
  });

  it('un límite secundario sin cabeceras detiene el trabajo con una espera de un minuto y pausa el proveedor', async () => {
    await ctx.prisma.featuredRepository.create({
      data: {
        name: 'limite',
        url: `https://github.com/cualquiera/secondary-limit`,
        description: { es: 'x', en: 'x' },
        technologies: [],
        tags: [],
        order: -1,
      },
    });
    const result = await runSync();
    expect(result.status).toBe('FAILED');
    const setting = await ctx.prisma.integrationSetting.findUniqueOrThrow({
      where: { provider: 'github' },
    });
    expect(setting.pausedUntil).not.toBeNull();
    await ctx.prisma.featuredRepository.deleteMany({ where: { name: 'limite' } });
  });

  describe('credencial', () => {
    it('(h) con GITHUB_SYNC_TOKEN definida el PUT de la credencial responde 422 y el origen es el servidor', async () => {
      const put = await http()
        .put('/api/admin/integrations/github/credential')
        .set('Cookie', cookie)
        .send({ secret: 'otro-secreto-que-no-se-guarda' });
      expect(put.status).toBe(422);

      const overview = await http().get('/api/admin/integrations').set('Cookie', cookie);
      const github = (overview.body.providers as Array<Record<string, unknown>>).find(
        (provider) => provider.provider === 'github',
      );
      expect(github?.credential).toMatchObject({ source: 'env' });
      expect(JSON.stringify(overview.body)).not.toContain(TEST_TOKEN);
    });

    it('sin la variable, la credencial cifrada guardada desde el panel alcanza para sincronizar', async () => {
      delete process.env.GITHUB_SYNC_TOKEN;
      const missing = await runSync();
      expect(missing.status).toBe('DEAD');
      expect(missing.lastError).toContain('credencial');

      const put = await http()
        .put('/api/admin/integrations/github/credential')
        .set('Cookie', cookie)
        .send({ secret: `db_${randomBytes(12).toString('hex')}` });
      expect(put.status).toBe(204);
      const result = await runSync();
      expect(result.status).toBe('DONE');
      expect(transport.requests.every((r) => r.hasAuthorization)).toBe(true);
    });

    it('(i) un error que contiene el secreto sale redactado en lastError y en el log', async () => {
      const spy = jest
        .spyOn(transport, 'get')
        .mockResolvedValueOnce(fail(transient(`falló la conexión con el token ${TEST_TOKEN}`)));
      const result = await runSync();
      spy.mockRestore();

      expect(result.status).toBe('FAILED');
      expect(result.lastError).toContain('[Redacted]');
      expect(result.lastError).not.toContain(TEST_TOKEN);
      expect(ctx.logLines().join('\n')).not.toContain(TEST_TOKEN);
    });
  });
});
