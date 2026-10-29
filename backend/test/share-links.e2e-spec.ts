/**
 * E2E — change `add-share-links`: atribución de la visita pública a un enlace de seguimiento
 * (`?via=`) y a un portal (`?src=`), el agregado `byShareLink` / `bySource` y el fragmento de
 * head. Los perfiles de prueba llevan el prefijo `sl-e2e` y se borran al final (los enlaces y
 * las visitas caen por cascada).
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';
import {
  BROWSER_UA,
  createE2eAdmin,
  createTestApp,
  deleteE2eAdmin,
  login,
  loginCookie,
  settleBackgroundTasks,
} from './e2e-helpers';

const SLUGS = {
  a: 'sl-e2e-a',
  b: 'sl-e2e-b',
  protectedProfile: 'sl-e2e-protegido',
  agg: 'sl-e2e-agregado',
} as const;
const ALL_SLUGS = [...Object.values(SLUGS), 'sl-e2e-renombrado'];
const TOKEN = 'tok-sl-e2e';

describe('Enlaces de seguimiento: atribución de la visita (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let bearer: string;
  let cookie: string;
  const ids: Record<string, string> = {};

  const server = () => app.getHttpServer();
  const admin = () => ({ Authorization: `Bearer ${bearer}` });

  async function createProfile(slug: string, extra: Record<string, unknown> = {}) {
    const res = await request(server())
      .post('/api/admin/curated-profiles')
      .set(admin())
      .send({
        slug,
        title: { es: `Perfil ${slug}`, en: `Profile ${slug}` },
        headline: { es: 'Titular', en: 'Headline' },
        filterTags: [],
        ...extra,
      });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  async function createLink(profileId: string, label: string, portal?: string) {
    const res = await request(server())
      .post(`/api/admin/curated-profiles/${profileId}/share-links`)
      .set(admin())
      .send(portal ? { label, portal } : { label });
    expect(res.status).toBe(201);
    return res.body as { id: string; code: string };
  }

  const revoke = (profileId: string, linkId: string) =>
    request(server())
      .post(`/api/admin/curated-profiles/${profileId}/share-links/${linkId}/revoke`)
      .set(admin())
      .expect(200);

  /** Visita pública con User-Agent de navegador; espera el segundo plano antes de volver. */
  async function visit(
    slug: string,
    query = '',
    headers: Record<string, string> = { 'User-Agent': BROWSER_UA },
  ) {
    const req = request(server()).get(`/api/curated-profiles/${slug}${query}`);
    for (const [name, value] of Object.entries(headers)) req.set(name, value);
    const res = await req;
    await settleBackgroundTasks(app);
    return res;
  }

  const lastView = async (profileId: string) =>
    prisma.profileView.findFirstOrThrow({
      where: { curatedProfileId: profileId },
      orderBy: { viewedAt: 'desc' },
    });
  const viewCount = (profileId: string) =>
    prisma.profileView.count({ where: { curatedProfileId: profileId } });

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await prisma.curatedProfile.deleteMany({ where: { slug: { in: ALL_SLUGS } } });
    await createE2eAdmin(prisma);
    bearer = await login(app);
    cookie = await loginCookie(app);
    ids.a = await createProfile(SLUGS.a);
    ids.b = await createProfile(SLUGS.b);
    ids.protectedProfile = await createProfile(SLUGS.protectedProfile, {
      visibility: 'PROTECTED',
      accessToken: TOKEN,
    });
  });

  afterAll(async () => {
    await prisma.curatedProfile.deleteMany({ where: { slug: { in: ALL_SLUGS } } });
    await deleteE2eAdmin(prisma);
    await app.close();
  });

  describe('atribución', () => {
    it('enlace activo del perfil: HUMAN con su shareLinkId', async () => {
      const link = await createLink(ids.a, 'Acme');
      const res = await visit(SLUGS.a, `?via=${link.code}`);
      expect(res.status).toBe(200);
      const row = await lastView(ids.a);
      expect(row.kind).toBe('HUMAN');
      expect(row.shareLinkId).toBe(link.id);
      expect(row.source).toBeNull();
    });

    it('el código se normaliza: mayúsculas y espacios alrededor atribuyen igual', async () => {
      const link = await createLink(ids.a, 'Con mayúsculas');
      await visit(SLUGS.a, `?via=%20${link.code.toUpperCase()}%20`);
      expect((await lastView(ids.a)).shareLinkId).toBe(link.id);
    });

    it('enlace revocado: 200, mismo cuerpo, sin atribuir', async () => {
      const link = await createLink(ids.a, 'Revocado');
      const plain = await visit(SLUGS.a);
      await revoke(ids.a, link.id);
      const res = await visit(SLUGS.a, `?via=${link.code}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(plain.body);
      const row = await lastView(ids.a);
      expect(row.shareLinkId).toBeNull();
      expect(row.kind).toBe('HUMAN');
    });

    it('enlace de otro perfil: 200 con el perfil pedido y sin atribuir', async () => {
      const foreign = await createLink(ids.b, 'De B');
      const res = await visit(SLUGS.a, `?via=${foreign.code}`);
      expect(res.status).toBe(200);
      expect(res.body.slug).toBe(SLUGS.a);
      expect((await lastView(ids.a)).shareLinkId).toBeNull();
    });

    it.each([
      ['inexistente de 10 caracteres', '0000000000'],
      ['malformado', 'no-existe'],
      ['con caracteres excluidos', 'iiiiiiiiii'],
      ['vacío', ''],
    ])('código %s: 200 y shareLinkId nulo', async (_name, via) => {
      const res = await visit(SLUGS.a, `?via=${via}`);
      expect(res.status).toBe(200);
      expect((await lastView(ids.a)).shareLinkId).toBeNull();
    });

    it('?src=Indeed: source normalizado, sin enlace y sin filas nuevas de ShareLink', async () => {
      const before = await prisma.shareLink.count();
      const res = await visit(SLUGS.a, '?src=Indeed');
      expect(res.status).toBe(200);
      const row = await lastView(ids.a);
      expect(row.source).toBe('indeed');
      expect(row.shareLinkId).toBeNull();
      expect(await prisma.shareLink.count()).toBe(before);
    });

    it.each([['a'.repeat(40)], ['mi%20portal'], ['-x']])(
      '?src=%s inválido: source nulo',
      async (src) => {
        const res = await visit(SLUGS.a, `?src=${src}`);
        expect(res.status).toBe(200);
        expect((await lastView(ids.a)).source).toBeNull();
      },
    );

    it('via con portal y src a la vez: gana el portal del enlace', async () => {
      const link = await createLink(ids.a, 'Con portal', 'LinkedIn');
      await visit(SLUGS.a, `?via=${link.code}&src=indeed`);
      const row = await lastView(ids.a);
      expect(row.shareLinkId).toBe(link.id);
      expect(row.source).toBe('linkedin');
    });

    it('enlace sin portal más src: queda el src', async () => {
      const link = await createLink(ids.a, 'Sin portal');
      await visit(SLUGS.a, `?via=${link.code}&src=Indeed`);
      const row = await lastView(ids.a);
      expect(row.shareLinkId).toBe(link.id);
      expect(row.source).toBe('indeed');
    });

    it('por el slug anterior (perfil renombrado): se atribuye al enlace', async () => {
      const renamedId = await createProfile('sl-e2e-renombrado');
      const link = await createLink(renamedId, 'Antes del renombrado');
      await request(server())
        .patch(`/api/admin/curated-profiles/${renamedId}`)
        .set(admin())
        .send({ slug: 'sl-e2e-renombrado-2' })
        .expect(200);
      try {
        const res = await visit('sl-e2e-renombrado', `?via=${link.code}`);
        expect(res.status).toBe(200);
        expect(res.headers['content-location']).toContain('sl-e2e-renombrado-2');
        expect((await lastView(renamedId)).shareLinkId).toBe(link.id);
      } finally {
        await prisma.curatedProfile.deleteMany({ where: { id: renamedId } });
      }
    });

    it('con la sesión del panel: fila OWNER con el enlace y las aperturas no cambian', async () => {
      const link = await createLink(ids.a, 'Prueba propia');
      const opens = async () =>
        (
          await request(server())
            .get(`/api/admin/curated-profiles/${ids.a}/share-links`)
            .set(admin())
        ).body.find((l: { id: string }) => l.id === link.id).opens as number;
      const before = await opens();
      await visit(SLUGS.a, `?via=${link.code}`, { 'User-Agent': BROWSER_UA, Cookie: cookie });
      const row = await lastView(ids.a);
      expect(row.kind).toBe('OWNER');
      expect(row.shareLinkId).toBe(link.id);
      expect(await opens()).toBe(before);
    });

    it('un bot por el enlace queda atribuido pero no cuenta como apertura', async () => {
      const link = await createLink(ids.a, 'Bot');
      await visit(SLUGS.a, `?via=${link.code}`, { 'User-Agent': 'Googlebot/2.1' });
      expect((await lastView(ids.a)).kind).toBe('BOT');
      expect((await lastView(ids.a)).shareLinkId).toBe(link.id);
    });
  });

  describe('la respuesta no cambia ni reemplaza al token', () => {
    it('mismo cuerpo sin via, con via válido y con via inexistente', async () => {
      const link = await createLink(ids.a, 'Cuerpo');
      const plain = await visit(SLUGS.a);
      const valid = await visit(SLUGS.a, `?via=${link.code}`);
      const missing = await visit(SLUGS.a, '?via=0000000000');
      expect(valid.status).toBe(200);
      expect(valid.body).toEqual(plain.body);
      expect(missing.body).toEqual(plain.body);
    });

    it('PROTECTED con via válido y sin token: 401 y ninguna fila', async () => {
      const link = await createLink(ids.protectedProfile, 'Protegido');
      const before = await viewCount(ids.protectedProfile);
      const res = await visit(SLUGS.protectedProfile, `?via=${link.code}`);
      expect(res.status).toBe(401);
      expect(await viewCount(ids.protectedProfile)).toBe(before);
    });

    it('PROTECTED con token y via: 200 y atribuida', async () => {
      const link = await createLink(ids.protectedProfile, 'Protegido con token');
      const res = await visit(SLUGS.protectedProfile, `?token=${TOKEN}&via=${link.code}`);
      expect(res.status).toBe(200);
      expect((await lastView(ids.protectedProfile)).shareLinkId).toBe(link.id);
    });

    it('parámetros repetidos o raros nunca dan 400', async () => {
      const repeated = await visit(SLUGS.a, '?via=a&via=b&src=x&src=y');
      expect(repeated.status).toBe(200);
      const odd = await visit(SLUGS.a, '?via[]=a&src[k]=v');
      expect(odd.status).toBe(200);
    });

    it('con via repetido toma el primer valor', async () => {
      const link = await createLink(ids.a, 'Primero');
      await visit(SLUGS.a, `?via=${link.code}&via=0000000000&src=Indeed&src=otro`);
      const row = await lastView(ids.a);
      expect(row.shareLinkId).toBe(link.id);
      expect(row.source).toBe('indeed');
    });
  });

  describe('agregado por enlace y por portal', () => {
    it('3 por «Acme» (linkedin), 2 con src=indeed, 1 directa y 1 BOT: desgloses exactos', async () => {
      const aggId = await createProfile(SLUGS.agg);
      const acme = await createLink(aggId, 'Acme', 'linkedin');
      const start = new Date();
      for (let i = 0; i < 3; i += 1) await visit(SLUGS.agg, `?via=${acme.code}`);
      for (let i = 0; i < 2; i += 1) await visit(SLUGS.agg, '?src=indeed');
      await visit(SLUGS.agg);
      await visit(SLUGS.agg, `?via=${acme.code}`, { 'User-Agent': 'Googlebot/2.1' });

      const views = async () =>
        (
          await request(server())
            .get('/api/admin/analytics/views')
            .query({ from: start.toISOString(), to: new Date().toISOString() })
            .set(admin())
            .expect(200)
        ).body;

      const body = await views();
      expect(body.total).toBe(6);
      expect(body.byShareLink).toEqual([
        {
          shareLinkId: acme.id,
          code: acme.code,
          label: 'Acme',
          slug: SLUGS.agg,
          portal: 'linkedin',
          revoked: false,
          views: 3,
        },
      ]);
      expect(body.bySource).toEqual([
        { source: 'linkedin', views: 3 },
        { source: 'indeed', views: 2 },
      ]);
      // La atribución no toca byReferrer: sin Referer todo es «directo» y suma el total.
      expect(body.byReferrer).toEqual([{ referrer: 'directo', views: 6 }]);
      expect(body.byKind).toEqual([
        { kind: 'HUMAN', views: 6 },
        { kind: 'OWNER', views: 0 },
        { kind: 'BOT', views: 1 },
      ]);

      // Revocado sigue apareciendo, marcado.
      await revoke(aggId, acme.id);
      const after = await views();
      expect(after.byShareLink).toHaveLength(1);
      expect(after.byShareLink[0]).toMatchObject({ shareLinkId: acme.id, revoked: true, views: 3 });
    });
  });

  describe('SEO: los links con código no son páginas aparte', () => {
    it('el fragmento de head ignora via y src', async () => {
      const link = await createLink(ids.a, 'Head');
      const path = '/api/public/profile-head?slug=tech-lead-dotnet';
      const plain = await request(server()).get(path).expect(200);
      const withCode = await request(server())
        .get(`${path}&via=${link.code}&src=indeed`)
        .expect(200);
      expect(withCode.text).toBe(plain.text);
      expect(withCode.text).not.toContain('via=');
      const canonical = /<link rel="canonical" href="([^"]+)"/.exec(withCode.text)?.[1];
      expect(canonical).toBeDefined();
      expect(canonical).not.toContain('?');
    });

    it('el fragmento no registra visitas', async () => {
      const row = await prisma.curatedProfile.findUniqueOrThrow({
        where: { slug: 'tech-lead-dotnet' },
      });
      const before = await viewCount(row.id);
      await request(server())
        .get('/api/public/profile-head?slug=tech-lead-dotnet&via=0000000000&src=x')
        .expect(200);
      await settleBackgroundTasks(app);
      expect(await viewCount(row.id)).toBe(before);
    });

    it('robots.txt no bloquea via ni src', async () => {
      const res = await request(server()).get('/robots.txt').expect(200);
      expect(res.text).not.toMatch(/via|src/);
    });
  });
});
