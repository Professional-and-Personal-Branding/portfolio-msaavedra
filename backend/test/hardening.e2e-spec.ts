/**
 * E2E — Fase 6: `api-platform` (errores), `api-health`, `api-rate-limiting`,
 * `api-security-headers`, `api-observability` y `public-seo`.
 * Requiere Postgres arriba y la base migrada + seedeada.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';
import {
  createE2eAdmin,
  createHardenedTestApp,
  createTestApp,
  deleteE2eAdmin,
  E2E_ADMIN,
  FRONTEND_URL,
  settleBackgroundTasks,
} from './e2e-helpers';

describe('Hardening de producción (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const get = (url: string) => request(app.getHttpServer()).get(url);
  const post = (url: string) => request(app.getHttpServer()).post(url);

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await createE2eAdmin(prisma);
  });

  afterAll(async () => {
    await deleteE2eAdmin(prisma);
    await app.close();
  });

  describe('Manejo global de errores (api-platform)', () => {
    it('un error de negocio conserva su status y suma requestId y timestamp', async () => {
      const res = await get('/api/curated-profiles/no-existe');

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ statusCode: 404, error: 'Not Found' });
      expect(typeof res.body.requestId).toBe('string');
      expect(Date.parse(res.body.timestamp as string)).not.toBeNaN();
    });

    it('ninguna respuesta de error filtra stack, Prisma ni rutas del servidor', async () => {
      for (const url of ['/api/curated-profiles/no-existe', '/api/experiences/xxx', '/api/nada']) {
        const res = await get(url);
        const body = JSON.stringify(res.body).toLowerCase();
        expect(body).not.toContain('prisma');
        expect(body).not.toContain('\\\\src\\\\');
        expect(body).not.toContain('node_modules');
        expect(res.body).not.toHaveProperty('stack');
      }
    });

    it('un cuerpo inválido conserva los mensajes de validación', async () => {
      const res = await post('/api/auth/login').send({ email: 'no-es-email' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
      expect(JSON.stringify(res.body.message)).toMatch(/email/i);
    });
  });

  describe('Healthcheck (api-health)', () => {
    it('responde 200 sin autenticación con la base arriba', async () => {
      const res = await get('/health');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: 'ok',
        checks: { database: { status: 'up' } },
      });
      expect(typeof res.body.uptime).toBe('number');
    });

    it('no revela nada sensible', async () => {
      const body = JSON.stringify((await get('/health')).body);

      expect(body).not.toContain('postgresql://');
      expect(body).not.toContain('DATABASE_URL');
      expect(body.toLowerCase()).not.toContain('jwt');
    });

    it('/health/live responde 200 sin tocar la base', async () => {
      const res = await get('/health/live');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('vive fuera del prefijo /api', async () => {
      expect((await get('/api/health')).status).toBe(404);
    });
  });

  describe('Cabeceras de seguridad (api-security-headers)', () => {
    let hardened: INestApplication;

    beforeAll(async () => {
      ({ app: hardened } = await createHardenedTestApp());
    });
    afterAll(async () => {
      await hardened.close();
    });

    it('incluye nosniff, no-referrer y frameguard, y oculta x-powered-by', async () => {
      const res = await request(hardened.getHttpServer()).get('/api/profile');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['referrer-policy']).toBe('no-referrer');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('sin producción no manda HSTS', async () => {
      const res = await request(hardened.getHttpServer()).get('/api/profile');
      expect(res.headers['strict-transport-security']).toBeUndefined();
    });
  });

  describe('Cabeceras y HTTPS en producción (api-security-headers)', () => {
    let production: INestApplication;

    beforeAll(async () => {
      ({ app: production } = await createHardenedTestApp({ production: true }));
    });
    afterAll(async () => {
      await production.close();
    });

    it('redirige a https una petición que llegó por http', async () => {
      const res = await request(production.getHttpServer())
        .get('/api/profile')
        .set('X-Forwarded-Proto', 'http')
        .set('Host', 'api.example.com');

      expect(res.status).toBe(301);
      expect(res.headers.location).toBe('https://api.example.com/api/profile');
    });

    it('deja pasar lo que ya viene por https y agrega HSTS', async () => {
      const res = await request(production.getHttpServer())
        .get('/api/profile')
        .set('X-Forwarded-Proto', 'https');

      expect(res.status).toBe(200);
      expect(res.headers['strict-transport-security']).toContain('max-age=');
    });
  });

  describe('Identificador de petición (api-observability)', () => {
    it('devuelve un X-Request-Id propio', async () => {
      const res = await get('/api/profile');
      expect(res.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('respeta el que envía el cliente y lo usa en el error', async () => {
      const res = await get('/api/curated-profiles/no-existe').set('X-Request-Id', 'trace-42');

      expect(res.get('X-Request-Id')).toBe('trace-42');
      expect(res.body.requestId).toBe('trace-42');
    });
  });

  describe('SEO (public-seo)', () => {
    it('sitemap.xml lista la home y los perfiles públicos, con URLs del frontend', async () => {
      const res = await get('/sitemap.xml');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/xml');
      expect(res.text).toContain(`<loc>${FRONTEND_URL}/</loc>`);
      expect(res.text).toContain(`<loc>${FRONTEND_URL}/tech-lead-dotnet</loc>`);
      expect(res.text).not.toContain('/all<');
    });

    it('un perfil que deja de ser público desaparece del sitemap', async () => {
      const profile = await prisma.curatedProfile.findUniqueOrThrow({
        where: { slug: 'devops-platform' },
      });
      try {
        await prisma.curatedProfile.update({
          where: { id: profile.id },
          data: { visibility: 'PRIVATE' },
        });
        expect((await get('/sitemap.xml')).text).not.toContain('/devops-platform<');
      } finally {
        await prisma.curatedProfile.update({
          where: { id: profile.id },
          data: { visibility: profile.visibility },
        });
      }
      expect((await get('/sitemap.xml')).text).toContain('/devops-platform<');
    });

    it('robots.txt bloquea el panel y apunta al sitemap', async () => {
      const res = await get('/robots.txt');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.text).toContain('Disallow: /admin');
      expect(res.text).toContain(`Sitemap: ${FRONTEND_URL}/sitemap.xml`);
    });
  });

  // add-server-rendered-head: el fragmento que el borde inserta en el HTML inicial.
  describe('Fragmento de head (public-seo)', () => {
    const head = (query: string) => get(`/api/public/profile-head?${query}`);
    const robots = (html: string) => /<meta name="robots" content="([^"]+)"/.exec(html)?.[1];
    const title = (html: string) => /<title>(.*?)<\/title>/.exec(html)?.[1];
    const canonicalOf = (html: string) => /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
    /** El `ProfilePage` embebido (upgrade-profile-structured-data); `undefined` si no hay bloque. */
    const jsonLd = (html: string) => {
      const raw = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)?.[1];
      return raw === undefined ? undefined : (JSON.parse(raw) as Record<string, unknown>);
    };
    const personOf = (html: string) => (jsonLd(html)?.mainEntity ?? {}) as Record<string, unknown>;

    async function withVisibility(
      slug: string,
      data: { visibility: 'PROTECTED' | 'PRIVATE'; accessToken?: string },
      check: () => Promise<void>,
    ) {
      const row = await prisma.curatedProfile.findUniqueOrThrow({ where: { slug } });
      try {
        await prisma.curatedProfile.update({ where: { id: row.id }, data });
        await check();
      } finally {
        await prisma.curatedProfile.update({
          where: { id: row.id },
          data: { visibility: row.visibility, accessToken: row.accessToken },
        });
      }
    }

    it('perfil público: 200 text/html con sus textos, canonical absoluto e index', async () => {
      const row = await prisma.curatedProfile.findUniqueOrThrow({
        where: { slug: 'tech-lead-dotnet' },
      });
      const res = await head('slug=tech-lead-dotnet');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
      expect(res.text).toContain(`<title>${(row.title as { es: string }).es} · `);
      expect(res.text).toContain(`href="${FRONTEND_URL}/tech-lead-dotnet"`);
      expect(robots(res.text)).toBe('index, follow');
      expect(res.text).toContain('application/ld+json');
    });

    it('en inglés cambia los textos y og:locale', async () => {
      const row = await prisma.curatedProfile.findUniqueOrThrow({
        where: { slug: 'tech-lead-dotnet' },
      });
      const res = await head('slug=tech-lead-dotnet&lang=en');
      expect(res.text).toContain(`<title>${(row.title as { en: string }).en} · `);
      expect(res.text).toContain('content="en_US"');
    });

    it('el canonical coincide con la URL del perfil en el sitemap', async () => {
      const canonical = /<link rel="canonical" href="([^"]+)"/.exec(
        (await head('slug=tech-lead-dotnet')).text,
      )?.[1];
      expect((await get('/sitemap.xml')).text).toContain(`<loc>${canonical}</loc>`);
    });

    it('PROTECTED, con o sin token: genérico, noindex y sin textos del perfil', async () => {
      const row = await prisma.curatedProfile.findUniqueOrThrow({
        where: { slug: 'devops-platform' },
      });
      const title = (row.title as { es: string }).es;
      await withVisibility(
        'devops-platform',
        { visibility: 'PROTECTED', accessToken: 'tok-head' },
        async () => {
          for (const query of ['slug=devops-platform', 'slug=devops-platform&token=tok-head']) {
            const res = await head(query);
            expect(res.status).toBe(200);
            expect(robots(res.text)).toBe('noindex, nofollow');
            expect(res.text).not.toContain(title);
            expect(res.text).not.toContain('application/ld+json');
          }
          const conHeader = await head('slug=devops-platform').set('X-Access-Token', 'tok-head');
          expect(conHeader.text).not.toContain(title);
          expect(conHeader.text).not.toContain('application/ld+json');
          expect(conHeader.text).not.toContain('ProfilePage');
        },
      );
    });

    it('PRIVATE e inexistente responden 200 con cuerpos idénticos', async () => {
      await withVisibility('devops-platform', { visibility: 'PRIVATE' }, async () => {
        const privado = await head('slug=devops-platform');
        const inexistente = await head('slug=no-existe-jamas');
        expect(privado.status).toBe(200);
        expect(inexistente.status).toBe(200);
        expect(privado.text).toBe(inexistente.text);
      });
    });

    // upgrade-profile-structured-data (D2, D6, D8): el JSON-LD ProfilePage del fragmento.
    describe('JSON-LD ProfilePage', () => {
      it.each(['es', 'en'] as const)(
        'tech-lead-dotnet en %s: ProfilePage con su Person',
        async (lang) => {
          const profile = await prisma.profile.findFirstOrThrow();
          const res = await head(`slug=tech-lead-dotnet&lang=${lang}`);
          const ld = jsonLd(res.text);

          expect(ld).toMatchObject({
            '@type': 'ProfilePage',
            inLanguage: lang,
            mainEntity: { '@type': 'Person', name: profile.fullName },
          });
          expect(ld?.url).toBe(canonicalOf(res.text));
          expect(ld?.url).toBe(`${FRONTEND_URL}/tech-lead-dotnet`);
          expect(ld?.name).toBe(title(res.text));
          expect((await get('/sitemap.xml')).text).toContain(`<loc>${String(ld?.url)}</loc>`);

          const knows = personOf(res.text).knowsAbout as string[];
          expect(knows.length).toBeGreaterThan(0);
          expect(knows.length).toBeLessThanOrEqual(50);
          expect(new Set(knows.map((skill) => skill.toLowerCase())).size).toBe(knows.length);
          // fix-error-contrast-and-date-modified: la fecha de edición (día UTC) sí; la de creación, nunca.
          expect(ld?.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(JSON.stringify(ld)).not.toContain('dateCreated');
        },
      );

      it('?via= y ?src= no cambian el bloque', async () => {
        const limpio = jsonLd((await head('slug=tech-lead-dotnet')).text);
        const conQuery = jsonLd(
          (await head('slug=tech-lead-dotnet&via=k7m2q9xw4t&src=linkedin')).text,
        );
        expect(conQuery).toEqual(limpio);
        expect(String(conQuery?.url)).not.toContain('?');
      });

      it('la home y otro perfil comparten el @id y la url del Person', async () => {
        const home = personOf((await head('slug=all')).text);
        const otro = personOf((await head('slug=tech-lead-dotnet')).text);
        expect(home['@id']).toBe(`${FRONTEND_URL}/#person`);
        expect(otro['@id']).toBe(home['@id']);
        expect(otro.url).toBe(home.url);
      });

      it('archivado e inexistente: genérico sin bloque, igual que un PRIVATE', async () => {
        const row = await prisma.curatedProfile.findUniqueOrThrow({
          where: { slug: 'devops-platform' },
        });
        try {
          await prisma.curatedProfile.update({
            where: { id: row.id },
            data: { archivedAt: new Date() },
          });
          const archivado = await head('slug=devops-platform');
          const inexistente = await head('slug=no-existe-jamas');
          expect(robots(archivado.text)).toBe('noindex, nofollow');
          expect(archivado.text).not.toContain('application/ld+json');
          expect(archivado.text).not.toContain('ProfilePage');
          expect(archivado.text).toBe(inexistente.text);
        } finally {
          await prisma.curatedProfile.update({
            where: { id: row.id },
            data: { archivedAt: row.archivedAt },
          });
        }
      });

      it('PUBLIC con listed: false emite el bloque y index, follow', async () => {
        const row = await prisma.curatedProfile.findUniqueOrThrow({
          where: { slug: 'devops-platform' },
        });
        try {
          await prisma.curatedProfile.update({ where: { id: row.id }, data: { listed: false } });
          const res = await head('slug=devops-platform');
          expect(robots(res.text)).toBe('index, follow');
          expect(jsonLd(res.text)).toMatchObject({ '@type': 'ProfilePage' });
        } finally {
          await prisma.curatedProfile.update({
            where: { id: row.id },
            data: { listed: row.listed },
          });
        }
      });
    });

    it('sin slug responde 200 con el genérico', async () => {
      const res = await head('');
      expect(res.status).toBe(200);
      expect(robots(res.text)).toBe('noindex, nofollow');
    });

    it('no registra visitas', async () => {
      const antes = await prisma.profileView.count();
      await head('slug=tech-lead-dotnet');
      await settleBackgroundTasks(app);
      expect(await prisma.profileView.count()).toBe(antes);
    });
  });

  describe('Rate limiting (api-rate-limiting)', () => {
    let limited: INestApplication;

    beforeAll(async () => {
      ({ app: limited } = await createHardenedTestApp({ loginLimit: 3 }));
      await createE2eAdmin(limited.get(PrismaService));
    });
    afterAll(async () => {
      await limited.close();
    });

    it('corta la fuerza bruta en el login con 429 y Retry-After', async () => {
      const attempt = () =>
        request(limited.getHttpServer())
          .post('/api/auth/login')
          .send({ email: E2E_ADMIN.email, password: 'incorrecta' });

      expect((await attempt()).status).toBe(401);
      expect((await attempt()).status).toBe(401);
      expect((await attempt()).status).toBe(401);

      const blocked = await attempt();
      expect(blocked.status).toBe(429);
      expect(blocked.headers['retry-after']).toBeDefined();
      // El mensaje no distingue entre email inexistente y contraseña incorrecta.
      expect(JSON.stringify(blocked.body)).not.toMatch(/email|contraseña incorrecta/i);
    });

    it('el healthcheck nunca se limita', async () => {
      for (let i = 0; i < 12; i += 1) {
        expect((await request(limited.getHttpServer()).get('/health/live')).status).toBe(200);
      }
    });

    // add-server-rendered-head: lo pide el borde en cada carga de HTML.
    it('el fragmento de head nunca se limita', async () => {
      for (let i = 0; i < 12; i += 1) {
        const res = await request(limited.getHttpServer()).get(
          '/api/public/profile-head?slug=tech-lead-dotnet',
        );
        expect(res.status).toBe(200);
      }
    });
  });
});
