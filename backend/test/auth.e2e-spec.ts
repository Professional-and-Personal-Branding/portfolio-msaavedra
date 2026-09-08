/**
 * E2E — spec `admin-authentication` + deltas de `api-platform` (CORS de escritura).
 * Requiere Postgres arriba y la base migrada + seedeada.
 */
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';
import { SESSION_COOKIE_NAME } from '../src/modules/auth/infrastructure/security/session-cookie';
import {
  createE2eAdmin,
  createTestApp,
  deleteE2eAdmin,
  E2E_ADMIN,
  FRONTEND_URL,
  login,
  loginCookie,
  sessionCookieOf,
} from './e2e-helpers';

describe('Autenticación del backoffice (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminId: string;

  const get = (url: string) => request(app.getHttpServer()).get(url);
  const post = (url: string) => request(app.getHttpServer()).post(url);

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    ({ id: adminId } = await createE2eAdmin(prisma));
  });

  afterAll(async () => {
    await deleteE2eAdmin(prisma);
    await app.close();
  });

  describe('POST /api/auth/login', () => {
    it('credenciales válidas → token Bearer, expiresIn, usuario sin hash; actualiza lastLoginAt', async () => {
      const before = await prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });
      const res = await post('/api/auth/login').send({
        email: E2E_ADMIN.email,
        password: E2E_ADMIN.password,
      });
      expect(res.status).toBe(200);
      expect(res.body.tokenType).toBe('Bearer');
      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body.accessToken.split('.')).toHaveLength(3);
      expect(typeof res.body.expiresIn).toBe('number');
      expect(res.body.user).toEqual({ id: adminId, email: E2E_ADMIN.email, name: E2E_ADMIN.name });
      expect(JSON.stringify(res.body)).not.toContain('argon2');

      const after = await prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });
      expect(after.lastLoginAt).not.toBeNull();
      expect(after.lastLoginAt!.getTime()).toBeGreaterThan(before.lastLoginAt?.getTime() ?? 0);
    });

    it('contraseña incorrecta y email inexistente → 401 con el mismo mensaje', async () => {
      const bad = await post('/api/auth/login').send({ email: E2E_ADMIN.email, password: 'nope' });
      const unknown = await post('/api/auth/login').send({
        email: 'nadie@test.local',
        password: 'nope',
      });
      expect(bad.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(bad.body.error).toBe('Unauthorized');
      expect(bad.body.message).toBe(unknown.body.message);
    });

    it('cuerpo inválido → 400', async () => {
      const res = await post('/api/auth/login').send({ email: 'no-es-email' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
    });
  });

  describe('JWT y rutas protegidas', () => {
    it('GET /api/auth/me con token válido → datos del admin', async () => {
      const token = await login(app);
      const res = await get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: adminId, email: E2E_ADMIN.email, name: E2E_ADMIN.name });
    });

    it('token con firma inválida o expirado → 401', async () => {
      const appSecret = process.env.JWT_SECRET as string;
      const forged = new JwtService({ secret: 'otro-secreto-distinto-largo' }).sign(
        { email: E2E_ADMIN.email, name: 'x' },
        { subject: adminId },
      );
      const expired = new JwtService({ secret: appSecret }).sign(
        { email: E2E_ADMIN.email, name: 'x' },
        { subject: adminId, expiresIn: -10 },
      );
      expect((await get('/api/auth/me').set('Authorization', `Bearer ${forged}`)).status).toBe(401);
      expect((await get('/api/auth/me').set('Authorization', `Bearer ${expired}`)).status).toBe(
        401,
      );
      expect((await get('/api/auth/me').set('Authorization', 'Bearer basura')).status).toBe(401);
    });

    it('token de un admin borrado → 401', async () => {
      const other = await createE2eAdmin(prisma, { email: 'e2e-otro@test.local' });
      const token = await login(app, other.email, other.password);
      await deleteE2eAdmin(prisma, other.email);
      const res = await get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    });

    it('rutas /api/admin/* sin token → 401 en todos los métodos', async () => {
      const server = app.getHttpServer();
      expect((await request(server).get('/api/admin/experiences')).status).toBe(401);
      expect((await request(server).post('/api/admin/experiences').send({})).status).toBe(401);
      expect((await request(server).patch('/api/admin/experiences/x').send({})).status).toBe(401);
      expect((await request(server).delete('/api/admin/experiences/x')).status).toBe(401);
      expect((await request(server).get('/api/admin/skill-categories')).status).toBe(401);
      expect((await request(server).get('/api/admin/curated-profiles')).status).toBe(401);
      expect((await request(server).get('/api/admin/analytics/views')).status).toBe(401);
      const count = await prisma.experience.count();
      expect(count).toBeGreaterThan(0); // nada se creó
    });

    it('con token válido, GET /api/admin/experiences → 200', async () => {
      const token = await login(app);
      const res = await get('/api/admin/experiences').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('rutas públicas siguen abiertas sin token', async () => {
      expect((await get('/api/profile')).status).toBe(200);
      expect((await get('/api/experiences')).status).toBe(200);
      expect((await get('/api/curated-profiles/all')).status).toBe(200);
    });
  });

  describe('contraseñas', () => {
    it('el hash en la base es argon2id y no contiene la contraseña', async () => {
      const row = await prisma.adminUser.findUniqueOrThrow({ where: { id: adminId } });
      expect(row.passwordHash.startsWith('$argon2id$')).toBe(true);
      expect(row.passwordHash).not.toContain(E2E_ADMIN.password);
    });
  });

  describe('sesión por cookie httpOnly (add-admin-backoffice)', () => {
    it('el login emite la cookie de sesión httpOnly, SameSite=Lax y Path=/', async () => {
      const res = await post('/api/auth/login').send({
        email: E2E_ADMIN.email,
        password: E2E_ADMIN.password,
      });
      expect(res.status).toBe(200);

      const cookie = sessionCookieOf(res.get('Set-Cookie'));
      expect(cookie).toBeDefined();
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toMatch(/Path=\//i);
      expect(cookie).not.toMatch(/Secure/i); // NODE_ENV de test no es production
      // el cuerpo sigue trayendo el token para clientes que usen Bearer
      expect(cookie).toContain(res.body.accessToken as string);
    });

    it('credenciales inválidas no emiten cookie', async () => {
      const res = await post('/api/auth/login').send({ email: E2E_ADMIN.email, password: 'nope' });
      expect(res.status).toBe(401);
      expect(sessionCookieOf(res.get('Set-Cookie'))).toBeUndefined();
    });

    it('la cookie autentica /api/auth/me y /api/admin/*', async () => {
      const cookie = await loginCookie(app);

      const me = await get('/api/auth/me').set('Cookie', cookie);
      expect(me.status).toBe(200);
      expect(me.body).toEqual({ id: adminId, email: E2E_ADMIN.email, name: E2E_ADMIN.name });

      expect((await get('/api/admin/experiences').set('Cookie', cookie)).status).toBe(200);
    });

    it('cookie con firma inválida → 401', async () => {
      const forged = new JwtService({ secret: 'otro-secreto-distinto-largo' }).sign(
        { email: E2E_ADMIN.email, name: 'x' },
        { subject: adminId },
      );
      const res = await get('/api/admin/experiences').set(
        'Cookie',
        `${SESSION_COOKIE_NAME}=${forged}`,
      );
      expect(res.status).toBe(401);
    });

    it('el header Bearer tiene prioridad y sigue funcionando sin cookie', async () => {
      const token = await login(app);
      const res = await get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', `${SESSION_COOKIE_NAME}=basura`);
      expect(res.status).toBe(200);
    });

    it('logout borra la cookie y deja la sesión inservible', async () => {
      const cookie = await loginCookie(app);
      const out = await post('/api/auth/logout').set('Cookie', cookie);
      expect(out.status).toBe(204);

      const cleared = sessionCookieOf(out.get('Set-Cookie'));
      expect(cleared).toBeDefined();
      expect(cleared).toMatch(new RegExp(`^${SESSION_COOKIE_NAME}=;`));

      // el navegador ya no tendría cookie; sin ella, 401
      expect((await get('/api/auth/me')).status).toBe(401);
      // y cerrar sesión dos veces no falla
      expect((await post('/api/auth/logout')).status).toBe(204);
    });
  });

  describe('CORS de escritura (api-platform)', () => {
    it('preflight permite POST y Authorization para el origen del frontend', async () => {
      const res = await request(app.getHttpServer())
        .options('/api/admin/experiences')
        .set('Origin', FRONTEND_URL)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'authorization, content-type');
      expect([200, 204]).toContain(res.status);
      expect(res.headers['access-control-allow-origin']).toBe(FRONTEND_URL);
      expect(res.headers['access-control-allow-methods']).toMatch(/POST/);
      expect(res.headers['access-control-allow-headers']).toMatch(/authorization/i);
    });

    it('permite credenciales para la cookie de sesión, con origen exacto', async () => {
      const res = await request(app.getHttpServer())
        .options('/api/auth/me')
        .set('Origin', FRONTEND_URL)
        .set('Access-Control-Request-Method', 'GET');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['access-control-allow-origin']).toBe(FRONTEND_URL);
      expect(res.headers['access-control-allow-origin']).not.toBe('*');
    });
  });
});
