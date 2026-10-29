/**
 * E2E — change `add-curated-profile-lifecycle`: duplicar, archivar, `listed` y
 * alias de slug, contra la base real (el adaptador Prisma, la transacción del
 * alias y la migración incluidos). Todo lo creado lleva el prefijo `lc-e2e` y se
 * borra al final; los alias caen por cascada.
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

const PREFIX = 'lc-e2e';

describe('Ciclo de vida de perfiles curados (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  const server = () => app.getHttpServer();
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
  const get = (url: string) => request(server()).get(url);
  const adminGet = (url: string) => auth(request(server()).get(url));
  const adminPost = (url: string) => auth(request(server()).post(url));
  const adminPatch = (url: string) => auth(request(server()).patch(url));

  const cleanup = () =>
    prisma.curatedProfile.deleteMany({ where: { slug: { startsWith: PREFIX } } });

  /** Crea un perfil de prueba y devuelve su id. */
  async function create(slug: string, extra: Record<string, unknown> = {}): Promise<string> {
    const res = await adminPost('/api/admin/curated-profiles').send({
      slug,
      title: { es: `Título ${slug}`, en: `Title ${slug}` },
      headline: { es: 'Titular', en: 'Headline' },
      filterTags: ['dotnet'],
      ...extra,
    });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  const publicSlugs = async () =>
    ((await get('/api/curated-profiles')).body as { slug: string }[]).map((p) => p.slug);
  const sitemap = async () => (await get('/sitemap.xml')).text;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await cleanup();
    await createE2eAdmin(prisma);
    token = await login(app);
  });

  afterAll(async () => {
    await cleanup();
    await deleteE2eAdmin(prisma);
    await app.close();
  });

  // ─── Duplicar ───────────────────────────────────────────────────────────
  describe('POST /api/admin/curated-profiles/:id/duplicate', () => {
    it('copia la configuración y nace retirado; el original no cambia', async () => {
      const id = await create(`${PREFIX}-dup`, {
        sectionsOrder: ['hero', 'experience', 'skills'],
        sectionsHidden: ['stats'],
        themeOverrides: { colors: { accent: '#5B2C87' } },
        accessToken: 'tok-original',
      });
      await prisma.curatedProfile.update({ where: { id }, data: { views: 40 } });

      const res = await adminPost(`/api/admin/curated-profiles/${id}/duplicate`);
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        slug: `${PREFIX}-dup-2`,
        visibility: 'PRIVATE',
        listed: false,
        accessToken: null,
        views: 0,
        archivedAt: null,
        filterTags: ['dotnet'],
        sectionsOrder: ['hero', 'experience', 'skills'],
        sectionsHidden: ['stats'],
        themeOverrides: { colors: { accent: '#5B2C87' } },
      });
      expect((await get(`/api/curated-profiles/${PREFIX}-dup-2`)).status).toBe(404);
      await settleBackgroundTasks(app);
      expect(await prisma.profileView.count({ where: { curatedProfileId: res.body.id } })).toBe(0);

      const original = await prisma.curatedProfile.findUniqueOrThrow({ where: { id } });
      expect(original).toMatchObject({
        slug: `${PREFIX}-dup`,
        visibility: 'PUBLIC',
        accessToken: 'tok-original',
        views: 40,
      });

      // Con `-2` ocupado, el siguiente es `-3`.
      const third = await adminPost(`/api/admin/curated-profiles/${id}/duplicate`);
      expect(third.body.slug).toBe(`${PREFIX}-dup-3`);
    });

    it('el cuerpo no acepta un slug; un id inexistente da 404', async () => {
      const id = await create(`${PREFIX}-dup-body`);
      const conSlug = await adminPost(`/api/admin/curated-profiles/${id}/duplicate`).send({
        slug: 'otro',
      });
      expect(conSlug.status).toBe(400);
      expect((await adminPost('/api/admin/curated-profiles/no-existe/duplicate')).status).toBe(404);
    });
  });

  // ─── Archivar ───────────────────────────────────────────────────────────
  describe('archivar y desarchivar', () => {
    it('archivado: 404 sin distinguirse, idempotente, conserva visitas y no registra nuevas', async () => {
      const slug = `${PREFIX}-arch`;
      const id = await create(slug);
      const antes = await get(`/api/curated-profiles/${slug}`).set('User-Agent', BROWSER_UA);
      expect(antes.status).toBe(200);
      await get(`/api/curated-profiles/${slug}`).set('User-Agent', BROWSER_UA);
      await settleBackgroundTasks(app);
      const visitas = await prisma.profileView.count({ where: { curatedProfileId: id } });
      expect(visitas).toBe(2);

      const archived = await adminPost(`/api/admin/curated-profiles/${id}/archive`);
      expect(archived.status).toBe(200);
      expect(archived.body.archivedAt).toEqual(expect.any(String));

      const res = await get(`/api/curated-profiles/${slug}`);
      expect(res.status).toBe(404);
      await settleBackgroundTasks(app);
      // Mismo 404 que un slug que nunca existió: solo cambia el slug nombrado.
      const inexistente = await get(`/api/curated-profiles/${PREFIX}-nada`);
      expect(res.body.statusCode).toBe(inexistente.body.statusCode);
      expect(String(res.body.message).replace(slug, '<slug>')).toBe(
        String(inexistente.body.message).replace(`${PREFIX}-nada`, '<slug>'),
      );
      expect(await prisma.profileView.count({ where: { curatedProfileId: id } })).toBe(visitas);

      const again = await adminPost(`/api/admin/curated-profiles/${id}/archive`);
      expect(again.body.archivedAt).toBe(archived.body.archivedAt);

      // Las visitas siguen en la analítica, y el perfil en byProfile.
      const hoy = new Date().toISOString().slice(0, 10);
      const analytics = await adminGet(`/api/admin/analytics/views?from=${hoy}&to=${hoy}`);
      const fila = (analytics.body.byProfile as { slug: string; views: number }[]).find(
        (p) => p.slug === slug,
      );
      expect(fila?.views).toBe(visitas);

      // Fuera del listado, del sitemap y del head.
      expect(await publicSlugs()).not.toContain(slug);
      expect(await sitemap()).not.toContain(`/${slug}<`);
      const head = (await get(`/api/public/profile-head?slug=${slug}`)).text;
      expect(head).toContain('noindex, nofollow');
      expect(head).not.toContain(`Título ${slug}`);

      const unarchived = await adminPost(`/api/admin/curated-profiles/${id}/unarchive`);
      expect(unarchived.status).toBe(200);
      expect(unarchived.body.archivedAt).toBeNull();
      const despues = await get(`/api/curated-profiles/${slug}`);
      expect(despues.status).toBe(200);
      expect(despues.body.title).toBe(antes.body.title);
    });

    it('PROTECTED archivado con token válido da 404, no 401 ni 200', async () => {
      const slug = `${PREFIX}-arch-prot`;
      const id = await create(slug, { visibility: 'PROTECTED', accessToken: 'tok-lc' });
      expect((await get(`/api/curated-profiles/${slug}`)).status).toBe(401);
      expect((await get(`/api/curated-profiles/${slug}?token=tok-lc`)).status).toBe(200);
      await adminPost(`/api/admin/curated-profiles/${id}/archive`);
      expect((await get(`/api/curated-profiles/${slug}`)).status).toBe(404);
      expect((await get(`/api/curated-profiles/${slug}?token=tok-lc`)).status).toBe(404);
    });

    it('archivedAt no se escribe por PATCH ni por POST', async () => {
      const id = await create(`${PREFIX}-arch-patch`);
      const patch = await adminPatch(`/api/admin/curated-profiles/${id}`).send({
        archivedAt: '2026-01-01T00:00:00Z',
      });
      expect(patch.status).toBe(400);
      const row = await prisma.curatedProfile.findUniqueOrThrow({ where: { id } });
      expect(row.archivedAt).toBeNull();

      const post = await adminPost('/api/admin/curated-profiles').send({
        slug: `${PREFIX}-arch-post`,
        title: { es: 'x' },
        headline: { es: 'y' },
        archivedAt: '2026-01-01T00:00:00Z',
      });
      expect(post.status).toBe(400);
    });

    it('archivar o desarchivar un id inexistente da 404', async () => {
      expect((await adminPost('/api/admin/curated-profiles/no-existe/archive')).status).toBe(404);
      expect((await adminPost('/api/admin/curated-profiles/no-existe/unarchive')).status).toBe(404);
    });
  });

  // ─── listed ─────────────────────────────────────────────────────────────
  describe('listed', () => {
    it('no enumerado: accesible por slug, ausente del listado y del sitemap', async () => {
      const slug = `${PREFIX}-dirigido`;
      const id = await create(slug);
      expect(await publicSlugs()).toContain(slug);

      const patch = await adminPatch(`/api/admin/curated-profiles/${id}`).send({ listed: false });
      expect(patch.status).toBe(200);
      expect(patch.body.listed).toBe(false);

      expect((await get(`/api/curated-profiles/${slug}`)).status).toBe(200);
      expect(await publicSlugs()).not.toContain(slug);
      expect(await sitemap()).not.toContain(`/${slug}<`);
    });

    it('listed no altera la visibilidad de un PROTECTED', async () => {
      const slug = `${PREFIX}-dirigido-prot`;
      await create(slug, { visibility: 'PROTECTED', accessToken: 'tok-d', listed: false });
      expect((await get(`/api/curated-profiles/${slug}`)).status).toBe(401);
      expect((await get(`/api/curated-profiles/${slug}?token=tok-d`)).status).toBe(200);
    });
  });

  // ─── Alias de slug ──────────────────────────────────────────────────────
  describe('alias de slug', () => {
    it('el link viejo sigue funcionando y trae el slug canónico', async () => {
      const viejo = `${PREFIX}-acme-tech-lead`;
      const nuevo = `${PREFIX}-acme-lead`;
      const id = await create(viejo);
      expect(
        (await adminPatch(`/api/admin/curated-profiles/${id}`).send({ slug: nuevo })).status,
      ).toBe(200);

      const res = await get(`/api/curated-profiles/${viejo}`);
      expect(res.status).toBe(200);
      expect(res.body.slug).toBe(nuevo);
      expect(res.headers['content-location']).toBe(`/api/curated-profiles/${nuevo}`);
      // Por el slug vigente no hay Content-Location.
      expect(
        (await get(`/api/curated-profiles/${nuevo}`)).headers['content-location'],
      ).toBeUndefined();

      // Solo el canónico se indexa; el head del alias apunta al canónico.
      const xml = await sitemap();
      expect(xml).toContain(`<loc>${FRONTEND_URL}/${nuevo}</loc>`);
      expect(xml).not.toContain(`/${viejo}<`);
      expect((await get(`/api/public/profile-head?slug=${viejo}`)).text).toContain(
        `href="${FRONTEND_URL}/${nuevo}"`,
      );

      // Un slug que es alias de otro perfil no se puede tomar.
      const choque = await adminPost('/api/admin/curated-profiles').send({
        slug: viejo,
        title: { es: 'x' },
        headline: { es: 'y' },
      });
      expect(choque.status).toBe(409);

      // Volver al slug anterior borra ese alias y deja el otro como alias.
      expect(
        (await adminPatch(`/api/admin/curated-profiles/${id}`).send({ slug: viejo })).status,
      ).toBe(200);
      const aliases = await prisma.curatedProfileSlugAlias.findMany({
        where: { curatedProfileId: id },
      });
      expect(aliases.map((a) => a.slug)).toEqual([nuevo]);

      // El alias de un perfil archivado no resuelve.
      await adminPost(`/api/admin/curated-profiles/${id}/archive`);
      expect((await get(`/api/curated-profiles/${nuevo}`)).status).toBe(404);
      expect((await get(`/api/curated-profiles/${viejo}`)).status).toBe(404);
    });
  });

  // ─── Un solo criterio de enumeración ────────────────────────────────────
  it('el sitemap y el listado público enumeran el mismo conjunto', async () => {
    const enLista = (await publicSlugs()).map((slug) => (slug === 'all' ? '/' : `/${slug}`));
    const enSitemap = [...(await sitemap()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (m) => m[1].replace(FRONTEND_URL, '') || '/',
    );
    expect([...enSitemap].sort()).toEqual([...enLista].sort());
  });
});
