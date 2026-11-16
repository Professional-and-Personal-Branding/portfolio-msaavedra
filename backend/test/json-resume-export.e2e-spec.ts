/**
 * E2E — change `add-json-resume-export`: exportación de un perfil curado como JSON Resume v1.0.0,
 * contra la base real (adaptadores Prisma incluidos). Lo creado lleva el prefijo `rs-e2e` y se
 * borra al final; las visitas del control llevan una marca y se borran; `views` y `updatedAt` de
 * los perfiles públicos se restauran.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';
import {
  BROWSER_UA,
  createE2eAdmin,
  createTestApp,
  deleteE2eAdmin,
  FRONTEND_URL,
  login,
  settleBackgroundTasks,
} from './e2e-helpers';
import { validateJsonResume } from './support/json-resume-validator';

const PREFIX = 'rs-e2e';
const MARK = 'ResumeExportE2E';
const SCHEMA_URL = 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json';
const LOCALES = ['es', 'en'] as const;

interface Resume {
  $schema: string;
  basics: Record<string, unknown> & { name?: string; label?: string; url?: string };
  work?: { name: string }[];
  projects?: { name: string }[];
  meta: { canonical: string; version: string; lastModified?: string };
  [key: string]: unknown;
}

describe('Exportación JSON Resume (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let snapshot: { id: string; views: number; updatedAt: Date }[] = [];
  let publicSlugs: string[] = [];

  const server = () => app.getHttpServer();
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
  const resume = (slug: string, query = '') =>
    request(server()).get(`/api/curated-profiles/${slug}/resume.json${query}`);
  const adminResume = (id: string, query = '') =>
    auth(request(server()).get(`/api/admin/curated-profiles/${id}/resume.json${query}`));

  async function create(slug: string, extra: Record<string, unknown> = {}): Promise<string> {
    const res = await auth(request(server()).post('/api/admin/curated-profiles')).send({
      slug,
      title: { es: `Título ${slug}`, en: `Title ${slug}` },
      headline: { es: 'Titular', en: 'Headline' },
      filterTags: ['dotnet'],
      ...extra,
    });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  const cleanup = () =>
    prisma.curatedProfile.deleteMany({ where: { slug: { startsWith: PREFIX } } });

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await cleanup();
    await createE2eAdmin(prisma);
    token = await login(app);
    const rows = await prisma.curatedProfile.findMany({
      where: { visibility: 'PUBLIC', archivedAt: null },
      select: { id: true, slug: true, views: true, updatedAt: true },
      orderBy: { slug: 'asc' },
    });
    snapshot = rows.map(({ id, views, updatedAt }) => ({ id, views, updatedAt }));
    publicSlugs = rows.map((row) => row.slug);
  });

  afterAll(async () => {
    await settleBackgroundTasks(app);
    await prisma.profileView.deleteMany({ where: { userAgent: { contains: MARK } } });
    for (const row of snapshot) {
      await prisma.curatedProfile.update({
        where: { id: row.id },
        data: { views: row.views, updatedAt: row.updatedAt },
      });
    }
    await cleanup();
    await deleteE2eAdmin(prisma);
    await app.close();
  });

  describe('ruta pública', () => {
    it('hay perfiles públicos en la base del e2e', () => {
      expect(publicSlugs.length).toBeGreaterThan(1);
      expect(publicSlugs).toContain('all');
    });

    it('cada perfil público, en es y en en, valida contra el schema y coincide con el detalle', async () => {
      for (const slug of publicSlugs) {
        for (const locale of LOCALES) {
          const res = await resume(slug, `?lang=${locale}`);
          expect(res.status).toBe(200);
          const doc = res.body as Resume;
          const check = validateJsonResume(doc);
          expect({ slug, locale, errors: check.errors }).toEqual({ slug, locale, errors: [] });
          expect(doc.$schema).toBe(SCHEMA_URL);
          expect(doc.meta.version).toBe('v1.0.0');
          expect(res.headers['content-language']).toBe(locale);

          // `work` repite, en el mismo orden, las experiencias de la vista resuelta.
          const detail = await request(server())
            .get(`/api/curated-profiles/${slug}?lang=${locale}`)
            .set('User-Agent', `${BROWSER_UA} ${MARK}`)
            .expect(200);
          const body = detail.body as {
            experiences: { company: string }[];
            projects: { name: string }[];
            sections: string[];
          };
          expect((doc.work ?? []).map((w) => w.name)).toEqual(
            body.sections.includes('experience') ? body.experiences.map((e) => e.company) : [],
          );
          expect((doc.projects ?? []).map((p) => p.name)).toEqual(
            body.sections.includes('projects') ? body.projects.map((p) => p.name) : [],
          );
        }
      }
    });

    it('el perfil de la home (`all`) sale en español por defecto, con su URL', async () => {
      const res = await resume('all');
      expect(res.status).toBe(200);
      expect(res.headers['content-language']).toBe('es');
      const doc = res.body as Resume;
      expect(doc.basics.url).toBe(`${FRONTEND_URL}/`);
      expect(doc.meta.canonical).toBe(
        `${FRONTEND_URL}/api/curated-profiles/all/resume.json?lang=es`,
      );
    });

    it('los textos cambian de idioma con el locale', async () => {
      const es = (await resume('tech-lead-dotnet', '?lang=es')).body as Resume;
      const en = (await resume('tech-lead-dotnet', '?lang=en')).body as Resume;
      expect(es.basics.label).not.toBe(en.basics.label);
      expect(en.meta.canonical).toContain('?lang=en');
    });

    it('las rutas vecinas siguen resolviendo: el detalle y un slug inexistente', async () => {
      const detail = await request(server())
        .get('/api/curated-profiles/tech-lead-dotnet')
        .set('User-Agent', `${BROWSER_UA} ${MARK}`)
        .expect(200);
      expect(detail.body.slug).toBe('tech-lead-dotnet');
      const res = await request(server()).get('/api/curated-profiles/resume.json').expect(404);
      expect(res.body.error).toBe('Not Found');
    });

    it('cabeceras de un perfil público', async () => {
      const res = await resume('tech-lead-dotnet', '?lang=en').expect(200);
      expect(res.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="tech-lead-dotnet.en.resume.json"',
      );
      expect(res.headers['x-robots-tag']).toBe('noindex');
      expect(res.headers['cache-control']).toBe('no-cache');
      expect(res.headers['content-location']).toBeUndefined();
    });

    it('una edición se ve en la siguiente descarga (sin caché del servidor)', async () => {
      const id = await create(`${PREFIX}-edit`, { filterTags: [], visibility: 'PUBLIC' });
      const antes = (await resume(`${PREFIX}-edit`)).body as Resume;
      await auth(request(server()).patch(`/api/admin/curated-profiles/${id}`))
        .send({ headline: { es: 'Titular nuevo', en: 'New headline' } })
        .expect(200);
      const despues = (await resume(`${PREFIX}-edit`)).body as Resume;
      expect(antes.basics.label).toBe('Titular');
      expect(despues.basics.label).toBe('Titular nuevo');
    });

    it('PRIVATE: 404 con error Not Found', async () => {
      await create(`${PREFIX}-private`, { visibility: 'PRIVATE' });
      const res = await resume(`${PREFIX}-private`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });

    it('archivado: 404, nunca 401', async () => {
      const id = await create(`${PREFIX}-archived`, {
        visibility: 'PROTECTED',
        accessToken: 'tok-archivado',
      });
      await auth(request(server()).post(`/api/admin/curated-profiles/${id}/archive`)).expect(200);
      expect((await resume(`${PREFIX}-archived`)).status).toBe(404);
      expect((await resume(`${PREFIX}-archived`, '?token=tok-archivado')).status).toBe(404);
    });

    it('PROTECTED: 401 sin token o con uno incorrecto; 200 por query y por header, sin el token en el cuerpo', async () => {
      await create(`${PREFIX}-protected`, {
        visibility: 'PROTECTED',
        accessToken: 'tok-secreto-rs',
      });
      const slug = `${PREFIX}-protected`;

      const sin = await resume(slug);
      expect(sin.status).toBe(401);
      expect(sin.body.error).toBe('Unauthorized');
      expect((await resume(slug, '?token=otro')).status).toBe(401);
      expect((await resume(slug).set('X-Access-Token', 'otro')).status).toBe(401);

      const porQuery = await resume(slug, '?token=tok-secreto-rs');
      const porHeader = await resume(slug).set('X-Access-Token', 'tok-secreto-rs');
      for (const res of [porQuery, porHeader]) {
        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('private, no-store');
        expect(res.headers['content-disposition']).toBe(
          `attachment; filename="${slug}.es.resume.json"`,
        );
        expect(JSON.stringify(res.body)).not.toContain('tok-secreto-rs');
        expect(validateJsonResume(res.body).errors).toEqual([]);
      }
    });

    it('slug anterior: 200 con Content-Location y canonical del slug vigente', async () => {
      const viejo = `${PREFIX}-nombre-anterior`;
      const nuevo = `${PREFIX}-renombrado`;
      const id = await create(viejo);
      await auth(request(server()).patch(`/api/admin/curated-profiles/${id}`))
        .send({ slug: nuevo })
        .expect(200);

      const res = await resume(viejo, '?lang=en');
      expect(res.status).toBe(200);
      expect(res.headers['content-location']).toBe(`/api/curated-profiles/${nuevo}/resume.json`);
      expect(res.headers['content-disposition']).toBe(
        `attachment; filename="${nuevo}.en.resume.json"`,
      );
      expect((res.body as Resume).meta.canonical).toBe(
        `${FRONTEND_URL}/api/curated-profiles/${nuevo}/resume.json?lang=en`,
      );
      expect((res.body as Resume).basics.url).toBe(`${FRONTEND_URL}/${nuevo}`);
    });

    it('filtros y overrides: excludeIds saca la experiencia y includeIds trae un proyecto sin tags en común', async () => {
      const slug = `${PREFIX}-overrides`;
      const experiencias = await prisma.experience.findMany({ where: { visible: true } });
      const excluida = experiencias[0];
      const id = await create(slug, {
        filterTags: ['dotnet'],
        excludeIds: [excluida.id],
      });
      const sinExcluida = (await resume(slug)).body as Resume;
      const detalle = await request(server())
        .get(`/api/curated-profiles/${slug}`)
        .set('User-Agent', `${BROWSER_UA} ${MARK}`)
        .expect(200);
      const empresas = (detalle.body.experiences as { id: string; company: string }[]).map(
        (e) => e.company,
      );
      expect(detalle.body.experiences.map((e: { id: string }) => e.id)).not.toContain(excluida.id);
      expect(sinExcluida.work?.map((w) => w.name)).toEqual(empresas);

      // Un proyecto sin tags en común entra por includeIds, igual que en la vista resuelta.
      const proyectos = await prisma.project.findMany({ where: { visible: true } });
      if (proyectos.length > 0) {
        const extra = proyectos[0];
        await auth(request(server()).patch(`/api/admin/curated-profiles/${id}`))
          .send({ filterTags: ['sin-coincidencias-rs'], includeIds: [extra.id] })
          .expect(200);
        const doc = (await resume(slug)).body as Resume;
        const view = await request(server())
          .get(`/api/curated-profiles/${slug}`)
          .set('User-Agent', `${BROWSER_UA} ${MARK}`)
          .expect(200);
        expect(doc.projects?.map((p) => p.name)).toEqual(
          (view.body.projects as { name: string }[]).map((p) => p.name),
        );
        expect(doc.projects?.length ?? 0).toBeGreaterThan(0);
      }
    });

    it('con secciones ocultas no salen sus claves', async () => {
      const slug = `${PREFIX}-ocultas`;
      await create(slug, {
        filterTags: [],
        sectionsHidden: ['presence', 'contact', 'certifications'],
      });
      const doc = (await resume(slug)).body as Resume;
      expect(validateJsonResume(doc).errors).toEqual([]);
      expect(doc.basics).not.toHaveProperty('profiles');
      expect(doc.basics).not.toHaveProperty('email');
      expect(doc.basics).not.toHaveProperty('phone');
      expect(doc).not.toHaveProperty('languages');
      expect(doc).not.toHaveProperty('certificates');
      expect(doc.basics.name).toBeDefined();
      expect(doc.work?.length ?? 0).toBeGreaterThan(0);
    });
  });

  describe('exportar no registra visita', () => {
    const SLUG = 'tech-lead-dotnet';

    it('dos descargas, también con ?via= y ?src=, no tocan ProfileView, views ni updatedAt', async () => {
      const row = await prisma.curatedProfile.findUniqueOrThrow({ where: { slug: SLUG } });
      // Un enlace activo del perfil: con `?via=` la visita real habría quedado atribuida.
      const link = await auth(
        request(server()).post(`/api/admin/curated-profiles/${row.id}/share-links`),
      )
        .send({ label: 'rs-e2e' })
        .expect(201);
      const code = link.body.code as string;

      await settleBackgroundTasks(app);
      const views = () => prisma.profileView.count({ where: { curatedProfileId: row.id } });
      const antes = {
        filas: await views(),
        perfil: await prisma.curatedProfile.findUniqueOrThrow({ where: { id: row.id } }),
      };

      const ua = `${BROWSER_UA} ${MARK}`;
      await resume(SLUG).set('User-Agent', ua).expect(200);
      await resume(SLUG, '?lang=en').set('User-Agent', ua).expect(200);
      await resume(SLUG, `?via=${code}&src=indeed`).set('User-Agent', ua).expect(200);
      await settleBackgroundTasks(app);

      const despues = await prisma.curatedProfile.findUniqueOrThrow({ where: { id: row.id } });
      expect(await views()).toBe(antes.filas);
      expect(despues.views).toBe(antes.perfil.views);
      expect(despues.updatedAt.toISOString()).toBe(antes.perfil.updatedAt.toISOString());

      // Limpieza del enlace de prueba (sin visitas atribuidas).
      await prisma.shareLink.deleteMany({ where: { id: link.body.id as string } });
    });

    it('control: el detalle sí registra visita (la prueba no es vacía)', async () => {
      const row = await prisma.curatedProfile.findUniqueOrThrow({ where: { slug: SLUG } });
      await settleBackgroundTasks(app);
      const antes = await prisma.profileView.count({ where: { curatedProfileId: row.id } });
      await request(server())
        .get(`/api/curated-profiles/${SLUG}`)
        .set('User-Agent', `${BROWSER_UA} ${MARK}`)
        .expect(200);
      await settleBackgroundTasks(app);
      expect(await prisma.profileView.count({ where: { curatedProfileId: row.id } })).toBe(
        antes + 1,
      );
    });

    it('la exportación del panel tampoco registra visita', async () => {
      const row = await prisma.curatedProfile.findUniqueOrThrow({ where: { slug: SLUG } });
      await settleBackgroundTasks(app);
      const antes = await prisma.curatedProfile.findUniqueOrThrow({ where: { id: row.id } });
      const filas = await prisma.profileView.count({ where: { curatedProfileId: row.id } });
      await adminResume(row.id, '?locale=en').expect(200);
      await settleBackgroundTasks(app);
      const despues = await prisma.curatedProfile.findUniqueOrThrow({ where: { id: row.id } });
      expect(despues.views).toBe(antes.views);
      expect(despues.updatedAt.toISOString()).toBe(antes.updatedAt.toISOString());
      expect(await prisma.profileView.count({ where: { curatedProfileId: row.id } })).toBe(filas);
    });
  });

  // add-github-code-evidence (D13): el lenguaje efectivo entra en `keywords`; stars, topics y
  // fechas de GitHub NO se exportan y la exportación no llama a GitHub (la evidencia sale de la base).
  describe('repositorios con evidencia de GitHub', () => {
    const URL_BASE = `https://github.com/${PREFIX}-owner`;
    const evidence = (repoKey: string, primaryLanguage: string) => ({
      repoKey,
      status: 'OK' as const,
      stars: 1234,
      primaryLanguage,
      languages: { [primaryLanguage]: 1000 },
      topics: ['tema-de-github'],
      pushedAt: new Date('2026-10-30T12:00:00Z'),
      verifiedAt: new Date('2026-11-16T10:00:00Z'),
      changedAt: new Date('2026-11-16T10:00:00Z'),
    });
    const cleanRepos = () =>
      prisma.featuredRepository.deleteMany({ where: { url: { startsWith: URL_BASE } } });

    beforeAll(async () => {
      await cleanRepos();
      const base = { description: { es: 'x', en: 'x' }, technologies: [] as string[], tags: [] };
      const sinManual = await prisma.featuredRepository.create({
        data: { ...base, name: `${PREFIX}-sin-manual`, url: `${URL_BASE}/sin-manual`, order: 900 },
      });
      const conManual = await prisma.featuredRepository.create({
        data: {
          ...base,
          name: `${PREFIX}-con-manual`,
          url: `${URL_BASE}/con-manual`,
          language: 'TypeScript',
          order: 901,
        },
      });
      await prisma.repositoryEvidence.create({
        data: {
          featuredRepositoryId: sinManual.id,
          ...evidence(`${PREFIX}-owner/sin-manual`, 'Java'),
        },
      });
      await prisma.repositoryEvidence.create({
        data: {
          featuredRepositoryId: conManual.id,
          ...evidence(`${PREFIX}-owner/con-manual`, 'JavaScript'),
        },
      });
    });

    afterAll(cleanRepos);

    it('sin lenguaje manual, el principal de GitHub es el primer keyword; con manual manda el manual', async () => {
      const res = await resume('all').expect(200);
      const doc = res.body as Omit<Resume, 'projects'> & {
        projects: { name: string; keywords?: string[]; type?: string }[];
      };
      const entry = (name: string) => doc.projects.find((p) => p.name === name);
      expect(entry(`${PREFIX}-sin-manual`)?.keywords?.[0]).toBe('Java');
      expect(entry(`${PREFIX}-con-manual`)?.keywords?.[0]).toBe('TypeScript');
      expect(entry(`${PREFIX}-sin-manual`)?.type).toBe('repository');
    });

    it('no exporta stars, topics ni fechas de GitHub y valida contra el schema', async () => {
      for (const locale of LOCALES) {
        const res = await resume('all', `?lang=${locale}`).expect(200);
        const doc = res.body as Resume;
        const entries = (doc.projects ?? []).filter((p) => p.name.startsWith(PREFIX));
        expect(entries).toHaveLength(2);
        const serialized = JSON.stringify(entries);
        expect(serialized).not.toContain('1234');
        expect(serialized).not.toContain('tema-de-github');
        expect(serialized).not.toContain('2026-11-16');
        expect(serialized).not.toMatch(/stars|topics|verifiedAt/i);
        expect(validateJsonResume(doc).errors).toEqual([]);
      }
    });
  });

  describe('ruta del panel', () => {
    it('sin sesión: 401', async () => {
      const row = await prisma.curatedProfile.findUniqueOrThrow({
        where: { slug: 'tech-lead-dotnet' },
      });
      const res = await request(server()).get(`/api/admin/curated-profiles/${row.id}/resume.json`);
      expect(res.status).toBe(401);
    });

    it('un perfil PRIVATE por id da 200 y un documento válido, sin token', async () => {
      const id = await create(`${PREFIX}-admin-private`, { visibility: 'PRIVATE' });
      const res = await adminResume(id, '?locale=en');
      expect(res.status).toBe(200);
      expect(validateJsonResume(res.body).errors).toEqual([]);
      expect(res.headers['cache-control']).toBe('private, no-store');
      expect(res.headers['content-language']).toBe('en');
      expect(res.headers['content-disposition']).toBe(
        `attachment; filename="${PREFIX}-admin-private.en.resume.json"`,
      );
      expect(res.headers['x-robots-tag']).toBe('noindex');
    });

    it('PROTECTED y archivado también se exportan por id', async () => {
      const id = await create(`${PREFIX}-admin-protected`, {
        visibility: 'PROTECTED',
        accessToken: 'tok-admin-rs',
      });
      expect((await adminResume(id)).status).toBe(200);
      await auth(request(server()).post(`/api/admin/curated-profiles/${id}/archive`)).expect(200);
      const res = await adminResume(id);
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain('tok-admin-rs');
    });

    it('un id inexistente da 404', async () => {
      const res = await adminResume('no-existe');
      expect(res.status).toBe(404);
    });

    it('paridad con la ruta pública para un perfil PUBLIC, en los dos idiomas', async () => {
      const row = await prisma.curatedProfile.findUniqueOrThrow({
        where: { slug: 'tech-lead-dotnet' },
      });
      for (const locale of LOCALES) {
        const publico = await resume('tech-lead-dotnet', `?lang=${locale}`).expect(200);
        const panel = await adminResume(row.id, `?locale=${locale}`).expect(200);
        expect(panel.text).toBe(publico.text);
      }
    });
  });
});
