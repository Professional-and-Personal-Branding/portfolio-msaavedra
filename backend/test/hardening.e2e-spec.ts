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
  });
});
