/**
 * E2E — change `add-admin-password-change`: cambio de contraseña desde el panel y revocación de
 * las demás sesiones por `sessionVersion`. Usa administradores PROPIOS (emails `password-e2e-*`),
 * creados y borrados acá, para no revocar la sesión de `E2E_ADMIN` que usan los demás archivos.
 * Las contraseñas se generan al azar en cada corrida y no se imprimen. Cada bloque que agota un
 * límite levanta su propia app para tener el contador limpio.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomBytes } from 'crypto';
import { Logger as PinoLogger, PARAMS_PROVIDER_TOKEN } from 'nestjs-pino';
import { Writable } from 'stream';
import request from 'supertest';
import { upsertAdminUser } from '../scripts/lib/bootstrap-admin';
import { GLOBAL_PREFIX, PREFIX_EXCLUDED_ROUTES } from '../src/app.constants';
import { AppModule } from '../src/app.module';
import {
  ADMIN_USER_REPOSITORY,
  AdminUserRepository,
} from '../src/modules/auth/domain/repositories/admin-user.repository';
import { Argon2PasswordHasher } from '../src/modules/auth/infrastructure/security/argon2-password-hasher';
import { buildLoggerOptions } from '../src/shared/infrastructure/http/logger.options';
import { requestIdMiddleware } from '../src/shared/infrastructure/http/request-id';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';
import {
  BROWSER_UA,
  createE2eAdmin,
  createHardenedTestApp,
  deleteE2eAdmin,
  sessionCookieOf,
  settleBackgroundTasks,
} from './e2e-helpers';

const random = (): string => randomBytes(18).toString('base64url');
const EMAILS = {
  main: 'password-e2e-main@example.com',
  legacy: 'password-e2e-legacy@example.com',
  repo: 'password-e2e-repo@example.com',
  race: 'password-e2e-race@example.com',
  boot: 'password-e2e-boot@example.com',
  limitBad: 'password-e2e-limit-bad@example.com',
  limitAnon: 'password-e2e-limit-anon@example.com',
  limitLogin: 'password-e2e-limit-login@example.com',
};
const SLUG = 'pwd-e2e-perfil';

/** App normal, con el logger real de la app escribiendo a memoria (para comprobar que no filtra). */
async function createCapturingApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
  logOutput: () => string;
}> {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });
  const options = buildLoggerOptions('info', true).pinoHttp as Record<string, unknown>;
  const { transport: _transport, ...rest } = options;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PARAMS_PROVIDER_TOKEN)
    .useValue({ pinoHttp: [rest, stream] })
    .compile();
  const app = moduleRef.createNestApplication();
  app.useLogger(app.get(PinoLogger));
  app.setGlobalPrefix(GLOBAL_PREFIX, { exclude: PREFIX_EXCLUDED_ROUTES });
  app.use(requestIdMiddleware);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.init();
  return { app, prisma: app.get(PrismaService), logOutput: () => chunks.join('') };
}

function adminName(email: string): string {
  return `Admin ${email.split('@')[0]}`;
}

describe('Cambio de contraseña del panel (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let logOutput: () => string;
  const seenSecrets: string[] = [];

  const server = () => app.getHttpServer();
  const login = (email: string, password: string) =>
    request(server()).post('/api/auth/login').send({ email, password });
  const change = (cookie: string, currentPassword: string, newPassword: string) =>
    request(server()).post('/api/auth/password').set('Cookie', cookie).send({
      currentPassword,
      newPassword,
    });
  const versionOf = async (email: string) =>
    (await prisma.adminUser.findUniqueOrThrow({ where: { email } })).sessionVersion;
  const cookieOf = (res: request.Response): string => {
    const cookie = sessionCookieOf(res.get('Set-Cookie'));
    if (!cookie) throw new Error('la respuesta no trajo la cookie de sesión');
    const pair = cookie.split(';')[0];
    seenSecrets.push(pair.slice(pair.indexOf('=') + 1));
    return pair;
  };

  const mainPassword = random();
  const nextPassword = random();
  const legacyPassword = random();
  let mainId: string;
  let legacyId: string;
  let cookieA: string;
  let bearerB: string;
  let profileId: string;

  beforeAll(async () => {
    ({ app, prisma, logOutput } = await createCapturingApp());
    await prisma.curatedProfile.deleteMany({ where: { slug: SLUG } });
    for (const email of Object.values(EMAILS)) await deleteE2eAdmin(prisma, email);
    ({ id: mainId } = await createE2eAdmin(prisma, {
      email: EMAILS.main,
      password: mainPassword,
      name: adminName(EMAILS.main),
    }));
    ({ id: legacyId } = await createE2eAdmin(prisma, {
      email: EMAILS.legacy,
      password: legacyPassword,
      name: adminName(EMAILS.legacy),
    }));
    seenSecrets.push(mainPassword, nextPassword, legacyPassword);

    const a = await login(EMAILS.main, mainPassword);
    expect(a.status).toBe(200);
    cookieA = cookieOf(a);
    const b = await login(EMAILS.main, mainPassword);
    bearerB = b.body.accessToken as string;
    seenSecrets.push(bearerB);

    // Perfil público de prueba (para el reconocimiento de visitas propias).
    const created = await request(server())
      .post('/api/admin/curated-profiles')
      .set('Authorization', `Bearer ${bearerB}`)
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
    for (const email of Object.values(EMAILS)) await deleteE2eAdmin(prisma, email);
    await app.close();
  });

  /** Una visita pública con la cookie dada; devuelve el `kind` con el que se registró. */
  const visit = async (cookie: string) => {
    const before = await prisma.profileView.count({ where: { curatedProfileId: profileId } });
    const res = await request(server())
      .get(`/api/curated-profiles/${SLUG}`)
      .set('User-Agent', BROWSER_UA)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    await settleBackgroundTasks(app);
    const rows = await prisma.profileView.findMany({
      where: { curatedProfileId: profileId },
      orderBy: { viewedAt: 'asc' },
    });
    expect(rows.length).toBe(before + 1);
    return rows[rows.length - 1].kind;
  };

  // ── Errores (antes del cambio exitoso: ninguno toca la base) ────────────────────────────
  describe('errores', () => {
    it('sin sesión → 401 y no se verifica ninguna contraseña', async () => {
      const res = await request(server())
        .post('/api/auth/password')
        .send({ currentPassword: mainPassword, newPassword: nextPassword });
      expect(res.status).toBe(401);
      expect(await versionOf(EMAILS.main)).toBe(0);
    });

    it('actual incorrecta → 401 genérico, sin Set-Cookie y sin cambios en la base', async () => {
      const before = await prisma.adminUser.findUniqueOrThrow({ where: { email: EMAILS.main } });
      const res = await change(cookieA, random(), nextPassword);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
      expect(res.get('Set-Cookie')).toBeUndefined();
      const after = await prisma.adminUser.findUniqueOrThrow({ where: { email: EMAILS.main } });
      expect(after.passwordHash).toBe(before.passwordHash);
      expect(after.sessionVersion).toBe(0);
    });

    it('nueva de 11 caracteres → 400', async () => {
      const res = await change(cookieA, mainPassword, 'a'.repeat(11));
      expect(res.status).toBe(400);
      expect(await versionOf(EMAILS.main)).toBe(0);
    });

    it('nueva igual a la actual (correcta) → 400 y la versión no cambia', async () => {
      const res = await change(cookieA, mainPassword, mainPassword);
      expect(res.status).toBe(400);
      expect(await versionOf(EMAILS.main)).toBe(0);
    });

    it('campo desconocido → 400; campo faltante → 400', async () => {
      const extra = await request(server()).post('/api/auth/password').set('Cookie', cookieA).send({
        currentPassword: mainPassword,
        newPassword: nextPassword,
        email: 'otro@example.com',
      });
      expect(extra.status).toBe(400);
      const missing = await request(server())
        .post('/api/auth/password')
        .set('Cookie', cookieA)
        .send({ currentPassword: mainPassword });
      expect(missing.status).toBe(400);
      expect(await versionOf(EMAILS.main)).toBe(0);
    });
  });

  it('antes del cambio, una visita con la cookie del panel es OWNER', async () => {
    await expect(visit(cookieA)).resolves.toBe('OWNER');
  });

  // ── Flujo completo e invalidación ───────────────────────────────────────────────────────
  describe('cambio exitoso', () => {
    let cookieNew: string;
    let bearerNew: string;

    it('responde 200 con el cuerpo del login y una cookie nueva; la versión pasa de 0 a 1', async () => {
      const changed = await change(cookieA, mainPassword, nextPassword);

      expect(changed.status).toBe(200);
      expect(changed.body).toEqual({
        accessToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: expect.any(Number),
        user: { id: mainId, email: EMAILS.main, name: adminName(EMAILS.main) },
      });
      const setCookie = sessionCookieOf(changed.get('Set-Cookie'));
      expect(setCookie).toMatch(/HttpOnly/i);
      expect(setCookie).toMatch(/Path=\//);
      cookieNew = cookieOf(changed);
      bearerNew = changed.body.accessToken as string;
      seenSecrets.push(bearerNew);
      expect(await versionOf(EMAILS.main)).toBe(1);
    });

    it('la cookie anterior de A da 401 en /me; la nueva da 200 sin sessionVersion', async () => {
      const old = await request(server()).get('/api/auth/me').set('Cookie', cookieA);
      expect(old.status).toBe(401);

      const fresh = await request(server()).get('/api/auth/me').set('Cookie', cookieNew);
      expect(fresh.status).toBe(200);
      expect(fresh.body).toEqual({ id: mainId, email: EMAILS.main, name: adminName(EMAILS.main) });

      const bearer = await request(server())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${bearerNew}`);
      expect(bearer.status).toBe(200);
      expect(bearer.body).not.toHaveProperty('sessionVersion');
    });

    it('el Bearer de la sesión B, emitido antes, da 401 en /api/admin/*', async () => {
      const old = await request(server())
        .get('/api/admin/experiences')
        .set('Authorization', `Bearer ${bearerB}`);
      expect(old.status).toBe(401);

      const fresh = await request(server())
        .get('/api/admin/experiences')
        .set('Authorization', `Bearer ${bearerNew}`);
      expect(fresh.status).toBe(200);
    });

    it('el login con la contraseña vieja da 401 y con la nueva 200', async () => {
      expect((await login(EMAILS.main, mainPassword)).status).toBe(401);
      expect((await login(EMAILS.main, nextPassword)).status).toBe(200);
    });

    it('un JWT firmado a mano sin sv: 401 con versión 1 y 200 con versión 0', async () => {
      const jwt = app.get(JwtService);
      const noSvMain = jwt.sign({ email: EMAILS.main, name: 'x' }, { subject: mainId });
      const noSvLegacy = jwt.sign({ email: EMAILS.legacy, name: 'x' }, { subject: legacyId });
      seenSecrets.push(noSvMain, noSvLegacy);

      const revoked = await request(server())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${noSvMain}`);
      expect(revoked.status).toBe(401);
      const legacy = await request(server())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${noSvLegacy}`);
      expect(legacy.status).toBe(200);
    });

    it('un sv que no es entero se rechaza', async () => {
      const bad = app
        .get(JwtService)
        .sign({ email: EMAILS.legacy, name: 'x', sv: '0' }, { subject: legacyId });
      const res = await request(server()).get('/api/auth/me').set('Authorization', `Bearer ${bad}`);
      expect(res.status).toBe(401);
    });

    it('una visita con la cookie revocada ya no es OWNER; con la nueva sí', async () => {
      await expect(visit(cookieA)).resolves.toBe('HUMAN');
      await expect(visit(cookieNew)).resolves.toBe('OWNER');
    });
  });

  // ── Repositorio ─────────────────────────────────────────────────────────────────────────
  describe('PrismaAdminUserRepository.changePassword', () => {
    it('con la versión esperada actualiza e incrementa; con una vieja devuelve null sin cambios', async () => {
      const repo = app.get<AdminUserRepository>(ADMIN_USER_REPOSITORY);
      const hasher = new Argon2PasswordHasher();
      const { id } = await createE2eAdmin(prisma, {
        email: EMAILS.repo,
        password: random(),
        name: adminName(EMAILS.repo),
      });
      const before = await prisma.adminUser.findUniqueOrThrow({ where: { id } });
      const newHash = await hasher.hash(random());

      const updated = await repo.changePassword(id, newHash, 0);
      expect(updated?.sessionVersion).toBe(1);
      expect(updated?.passwordHash).toBe(newHash);

      const stale = await repo.changePassword(id, await hasher.hash(random()), 0);
      expect(stale).toBeNull();
      const after = await prisma.adminUser.findUniqueOrThrow({ where: { id } });
      expect(after.passwordHash).toBe(newHash);
      expect(after.passwordHash).not.toBe(before.passwordHash);
      expect(after.sessionVersion).toBe(1);

      expect(await repo.changePassword('no-existe', newHash, 0)).toBeNull();
    });

    it('dos cambios simultáneos con la misma sesión: gana uno solo', async () => {
      const password = random();
      await createE2eAdmin(prisma, {
        email: EMAILS.race,
        password,
        name: adminName(EMAILS.race),
      });
      const cookie = cookieOf(await login(EMAILS.race, password));

      const results = await Promise.all([
        change(cookie, password, random()),
        change(cookie, password, random()),
      ]);

      expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
      expect(await versionOf(EMAILS.race)).toBe(1);
    });
  });

  // ── Bootstrap (D10) ─────────────────────────────────────────────────────────────────────
  describe('admin:bootstrap', () => {
    it('re-ejecutarlo incrementa sessionVersion y el token anterior da 401', async () => {
      const hasher = new Argon2PasswordHasher();
      const first = random();
      const created = await upsertAdminUser(prisma, {
        email: EMAILS.boot,
        passwordHash: await hasher.hash(first),
        name: 'Boot',
      });
      expect(created).toMatchObject({ created: true, sessionVersion: 0 });

      const session = await login(EMAILS.boot, first);
      expect(session.status).toBe(200);
      const token = session.body.accessToken as string;
      seenSecrets.push(token);
      const valid = await request(server())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(valid.status).toBe(200);

      const second = random();
      const updated = await upsertAdminUser(prisma, {
        email: EMAILS.boot,
        passwordHash: await hasher.hash(second),
        name: 'Boot',
      });
      expect(updated).toMatchObject({ created: false, sessionVersion: 1 });

      const revoked = await request(server())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(revoked.status).toBe(401);
      expect((await login(EMAILS.boot, second)).status).toBe(200);
    });
  });

  // ── Logs ────────────────────────────────────────────────────────────────────────────────
  describe('logs', () => {
    it('ninguna contraseña ni JWT de todo el archivo aparece en la salida del logger', () => {
      const output = logOutput();
      // No vacío: si el logger no capturara nada, la prueba no demostraría nada.
      expect(output).toContain('/api/auth/password');
      expect(output).toContain('/api/auth/login');
      expect(seenSecrets.length).toBeGreaterThan(8);
      for (const secret of seenSecrets) {
        expect(output.includes(secret)).toBe(false);
      }
    });
  });
});

// ── Límite ────────────────────────────────────────────────────────────────────────────────
describe('Límite del cambio de contraseña (e2e)', () => {
  const apps: INestApplication[] = [];
  let prisma: PrismaService | undefined;

  afterAll(async () => {
    if (prisma) {
      for (const email of [EMAILS.limitBad, EMAILS.limitAnon, EMAILS.limitLogin]) {
        await deleteE2eAdmin(prisma, email);
      }
    }
    await Promise.all(apps.map((a) => a.close()));
  });

  async function limitedApp(email: string) {
    const created = await createHardenedTestApp({ loginLimit: 5 });
    apps.push(created.app);
    prisma = created.prisma;
    const password = random();
    await createE2eAdmin(created.prisma, { email, password, name: adminName(email) });
    const server = created.app.getHttpServer();
    const loginRes = await request(server).post('/api/auth/login').send({ email, password });
    expect(loginRes.status).toBe(200);
    const cookie = (sessionCookieOf(loginRes.get('Set-Cookie')) ?? '').split(';')[0];
    const change = (cookieHeader: string | null, currentPassword: string, newPassword: string) => {
      const req = request(server).post('/api/auth/password');
      if (cookieHeader) req.set('Cookie', cookieHeader);
      return req.send({ currentPassword, newPassword });
    };
    return { server, cookie, password, change };
  }

  it('5 intentos con la actual incorrecta → 401 y el sexto 429 con Retry-After', async () => {
    const { cookie, change } = await limitedApp(EMAILS.limitBad);
    for (let i = 0; i < 5; i += 1) {
      expect((await change(cookie, random(), random())).status).toBe(401);
    }
    const sixth = await change(cookie, random(), random());
    expect(sixth.status).toBe(429);
    expect(Number(sixth.get('Retry-After'))).toBeGreaterThan(0);
    expect(sixth.body.message).toMatch(/cambio de contraseña/);
  });

  it('las peticiones anónimas no consumen el cupo', async () => {
    const { cookie, password, change } = await limitedApp(EMAILS.limitAnon);
    for (let i = 0; i < 6; i += 1) {
      expect((await change(null, password, random())).status).toBe(401);
    }
    expect((await change(cookie, password, random())).status).toBe(200);
  });

  it('agotar el login no cuenta para el cambio', async () => {
    const { server, cookie, password, change } = await limitedApp(EMAILS.limitLogin);
    // Ya hizo 1 login; 4 más agotan el cupo del login y el siguiente es 429.
    for (let i = 0; i < 4; i += 1) {
      const bad = await request(server)
        .post('/api/auth/login')
        .send({ email: EMAILS.limitLogin, password: random() });
      expect(bad.status).toBe(401);
    }
    const blocked = await request(server)
      .post('/api/auth/login')
      .send({ email: EMAILS.limitLogin, password: random() });
    expect(blocked.status).toBe(429);

    expect((await change(cookie, password, random())).status).toBe(200);
  });
});
