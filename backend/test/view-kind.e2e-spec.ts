/**
 * E2E — change `classify-profile-views`: cada visita pública se guarda con su
 * `kind` (OWNER por la sesión del panel, BOT por el User-Agent, HUMAN el resto) y
 * solo las HUMAN suman en `views` y en el agregado. El perfil de prueba lleva el
 * prefijo `vk-e2e` y se borra al final (las visitas caen por cascada).
 */
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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

const SLUG = 'vk-e2e-perfil';
const GOOGLEBOT_UA =
  'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const HEADLESS_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36';

describe('Tipo de visita (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let cookie: string;
  let profileId: string;

  const server = () => app.getHttpServer();
  const visit = (headers: Record<string, string> = {}) => {
    const req = request(server()).get(`/api/curated-profiles/${SLUG}`);
    for (const [name, value] of Object.entries(headers)) req.set(name, value);
    return req;
  };
  const profile = () => prisma.curatedProfile.findUniqueOrThrow({ where: { id: profileId } });
  const rows = () =>
    prisma.profileView.findMany({
      where: { curatedProfileId: profileId },
      orderBy: { viewedAt: 'asc' },
    });

  /** Hace una visita, espera el segundo plano y devuelve su fila y el delta de `views`. */
  async function visitAndRead(headers: Record<string, string> = {}) {
    const before = { rows: (await rows()).length, views: (await profile()).views };
    const res = await visit(headers);
    await settleBackgroundTasks(app);
    const after = await rows();
    return {
      res,
      row: after[after.length - 1],
      created: after.length - before.rows,
      viewsDelta: (await profile()).views - before.views,
    };
  }

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await prisma.curatedProfile.deleteMany({ where: { slug: SLUG } });
    await createE2eAdmin(prisma);
    token = await login(app);
    cookie = await loginCookie(app);
    const created = await request(server())
      .post('/api/admin/curated-profiles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        slug: SLUG,
        title: { es: 'Perfil de prueba', en: 'Test profile' },
        headline: { es: 'Titular', en: 'Headline' },
        filterTags: [],
      });
    expect(created.status).toBe(201);
    profileId = created.body.id as string;
  });

  afterAll(async () => {
    await prisma.curatedProfile.deleteMany({ where: { slug: SLUG } });
    await deleteE2eAdmin(prisma);
    await app.close();
  });

  it('User-Agent de navegador sin sesión: HUMAN y views +1', async () => {
    const { res, row, created, viewsDelta } = await visitAndRead({ 'User-Agent': BROWSER_UA });
    expect(res.status).toBe(200);
    expect(created).toBe(1);
    expect(row.kind).toBe('HUMAN');
    expect(viewsDelta).toBe(1);
  });

  it('con la cookie del panel: OWNER, views igual', async () => {
    const { res, row, created, viewsDelta } = await visitAndRead({
      'User-Agent': BROWSER_UA,
      Cookie: cookie,
    });
    expect(res.status).toBe(200);
    expect(created).toBe(1);
    expect(row.kind).toBe('OWNER');
    expect(viewsDelta).toBe(0);
  });

  it('con Authorization: Bearer de admin: OWNER', async () => {
    const { res, row, viewsDelta } = await visitAndRead({
      'User-Agent': BROWSER_UA,
      Authorization: `Bearer ${token}`,
    });
    expect(res.status).toBe(200);
    expect(row.kind).toBe('OWNER');
    expect(viewsDelta).toBe(0);
  });

  it('la sesión gana al User-Agent: HeadlessChrome con cookie es OWNER', async () => {
    const { row } = await visitAndRead({ 'User-Agent': HEADLESS_UA, Cookie: cookie });
    expect(row.kind).toBe('OWNER');
  });

  it('el token de la sesión no se persiste en ninguna columna', async () => {
    const { row } = await visitAndRead({ 'User-Agent': BROWSER_UA, Cookie: cookie });
    const jwt = cookie.split('=')[1];
    expect(jwt.length).toBeGreaterThan(20);
    for (const value of Object.values(row)) {
      if (typeof value === 'string') expect(value).not.toContain(jwt);
    }
  });

  describe('cookie vencida o forjada', () => {
    const expiredCookie = () => {
      const secret = process.env.JWT_SECRET as string;
      const jwt = new JwtService({ secret }).sign(
        { sub: 'x', email: 'x@x', name: 'x' },
        { expiresIn: -60 },
      );
      return `portfolio_session=${jwt}`;
    };
    const forgedCookie = () => {
      const jwt = new JwtService({ secret: 'otro-secreto-distinto-largo' }).sign(
        { sub: 'x', email: 'x@x', name: 'x' },
        { expiresIn: 600 },
      );
      return `portfolio_session=${jwt}`;
    };

    it.each([
      ['vencida', expiredCookie],
      ['firmada con otro secreto', forgedCookie],
    ])('%s: 200 con el mismo cuerpo que sin cookie, fila HUMAN y views +1', async (_n, make) => {
      const plain = await visit({ 'User-Agent': BROWSER_UA });
      await settleBackgroundTasks(app);
      const { res, row, viewsDelta } = await visitAndRead({
        'User-Agent': BROWSER_UA,
        Cookie: make(),
      });
      expect(res.status).toBe(200);
      expect(res.body).toEqual(plain.body);
      expect(row.kind).toBe('HUMAN');
      expect(viewsDelta).toBe(1);
    });
  });

  it('Googlebot: BOT y views igual', async () => {
    const { res, row, viewsDelta } = await visitAndRead({ 'User-Agent': GOOGLEBOT_UA });
    expect(res.status).toBe(200);
    expect(row.kind).toBe('BOT');
    expect(viewsDelta).toBe(0);
  });

  it('HeadlessChrome: BOT y views igual', async () => {
    const { row, viewsDelta } = await visitAndRead({ 'User-Agent': HEADLESS_UA });
    expect(row.kind).toBe('BOT');
    expect(viewsDelta).toBe(0);
  });

  it('sin User-Agent: BOT', async () => {
    const { res, row, viewsDelta } = await visitAndRead({});
    expect(res.status).toBe(200);
    expect(row.kind).toBe('BOT');
    expect(row.userAgent).toBeNull();
    expect(viewsDelta).toBe(0);
  });

  it('User-Agent: TestUA: HUMAN y views +1 (visita registrada)', async () => {
    const { row, viewsDelta } = await visitAndRead({ 'User-Agent': 'TestUA' });
    expect(row.kind).toBe('HUMAN');
    expect(row.userAgent).toBe('TestUA');
    expect(viewsDelta).toBe(1);
  });

  it('views del perfil es la cantidad de filas HUMAN', async () => {
    const all = await rows();
    expect((await profile()).views).toBe(all.filter((r) => r.kind === 'HUMAN').length);
  });

  it('el agregado cuenta solo HUMAN y byKind trae todo, en orden', async () => {
    const start = new Date();
    await visit({ 'User-Agent': BROWSER_UA, 'Accept-Language': 'es' });
    await visit({ 'User-Agent': BROWSER_UA });
    await visit({ 'User-Agent': BROWSER_UA, Cookie: cookie });
    await visit({ 'User-Agent': GOOGLEBOT_UA });
    await settleBackgroundTasks(app);
    const end = new Date(Date.now() + 1000);

    const res = await request(server())
      .get('/api/admin/analytics/views')
      .query({ from: start.toISOString(), to: end.toISOString() })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    const sum = (list: { views: number }[]) => list.reduce((acc, r) => acc + r.views, 0);
    expect(sum(res.body.byProfile)).toBe(2);
    expect(sum(res.body.byLocale)).toBe(2);
    expect(sum(res.body.byDay)).toBe(2);
    expect(sum(res.body.byReferrer)).toBe(2);
    expect(res.body.byKind).toEqual([
      { kind: 'HUMAN', views: 2 },
      { kind: 'OWNER', views: 1 },
      { kind: 'BOT', views: 1 },
    ]);
  });

  it('un rango sin visitas devuelve los tres tipos en cero', async () => {
    const res = await request(server())
      .get('/api/admin/analytics/views?from=2000-01-01&to=2000-01-02')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.byKind).toEqual([
      { kind: 'HUMAN', views: 0 },
      { kind: 'OWNER', views: 0 },
      { kind: 'BOT', views: 0 },
    ]);
  });
});
