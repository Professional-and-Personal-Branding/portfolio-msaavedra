/**
 * Utilidades compartidas por los e2e de Fase 3: app de pruebas, administrador
 * efímero (creado en beforeAll y borrado en afterAll) y login.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { GLOBAL_PREFIX, PREFIX_EXCLUDED_ROUTES } from '../src/app.constants';
import { AppModule } from '../src/app.module';
import { Argon2PasswordHasher } from '../src/modules/auth/infrastructure/security/argon2-password-hasher';
import { SESSION_COOKIE_NAME } from '../src/modules/auth/infrastructure/security/session-cookie';
import { BACKGROUND_TASKS, BackgroundTasks } from '../src/shared/application/background-tasks';
import { buildCorsOptions } from '../src/shared/infrastructure/http/cors.options';
import { requestIdMiddleware } from '../src/shared/infrastructure/http/request-id';
import { buildHelmet, httpsRedirect } from '../src/shared/infrastructure/http/security.middleware';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';
import { setupSwagger, shouldPublishDocs } from '../src/swagger';

export const FRONTEND_URL = 'http://localhost:5173';

// Los e2e hacen muchos logins seguidos: sin esto, el límite de la Fase 6 los
// cortaría. El suite de hardening baja estos valores a propósito.
process.env.THROTTLE_LIMIT ??= '10000';
process.env.THROTTLE_LOGIN_LIMIT ??= '1000';
export const E2E_ADMIN = {
  email: 'e2e-admin@test.local',
  password: 'E2E-pass-123!',
  name: 'E2E Admin',
};

export async function createTestApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix(GLOBAL_PREFIX, { exclude: PREFIX_EXCLUDED_ROUTES });
  app.use(requestIdMiddleware);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.enableCors(buildCorsOptions(FRONTEND_URL));
  if (shouldPublishDocs(process.env.NODE_ENV ?? 'test', process.env.ENABLE_API_DOCS)) {
    setupSwagger(app);
  }
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

/**
 * App de pruebas con la configuración de producción de `main.ts`: helmet,
 * redirección HTTPS y los límites que se quieran forzar (decisión D10).
 */
export async function createHardenedTestApp(
  options: { production?: boolean; loginLimit?: number } = {},
): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    loginLimit: process.env.THROTTLE_LOGIN_LIMIT,
    frontendUrl: process.env.FRONTEND_URL,
  };
  if (options.production) {
    process.env.NODE_ENV = 'production';
    // Las reglas de producción exigen https y un secreto fuerte.
    process.env.FRONTEND_URL = 'https://portafolio.test';
    process.env.JWT_SECRET = 'x'.repeat(48);
  }
  if (options.loginLimit !== undefined) {
    process.env.THROTTLE_LOGIN_LIMIT = String(options.loginLimit);
  }

  try {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication<NestExpressApplication>();
    app.setGlobalPrefix(GLOBAL_PREFIX, { exclude: PREFIX_EXCLUDED_ROUTES });
    app.use(requestIdMiddleware);
    app.set('trust proxy', 1);
    app.use(httpsRedirect(options.production === true));
    app.use(buildHelmet(options.production === true));
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.enableCors(buildCorsOptions(FRONTEND_URL));
    await app.init();
    return { app, prisma: app.get(PrismaService) };
  } finally {
    process.env.NODE_ENV = previous.nodeEnv;
    process.env.THROTTLE_LOGIN_LIMIT = previous.loginLimit;
    process.env.FRONTEND_URL = previous.frontendUrl;
  }
}

/**
 * Espera a que terminen las tareas en segundo plano (el registro de visitas ya
 * no forma parte de la respuesta). Llamarlo antes de leer `ProfileView` o
 * `views`, también al comprobar que NO se registró nada. Nunca usar `sleep`.
 */
export async function settleBackgroundTasks(app: INestApplication): Promise<void> {
  await app.get<BackgroundTasks>(BACKGROUND_TASKS).whenIdle();
}

export async function createE2eAdmin(
  prisma: PrismaService,
  overrides: Partial<typeof E2E_ADMIN> = {},
): Promise<{ id: string; email: string; password: string }> {
  const admin = { ...E2E_ADMIN, ...overrides };
  const passwordHash = await new Argon2PasswordHasher().hash(admin.password);
  const row = await prisma.adminUser.upsert({
    where: { email: admin.email },
    create: { email: admin.email, passwordHash, name: admin.name },
    update: { passwordHash, name: admin.name },
  });
  return { id: row.id, email: admin.email, password: admin.password };
}

export async function deleteE2eAdmin(
  prisma: PrismaService,
  email = E2E_ADMIN.email,
): Promise<void> {
  await prisma.adminUser.deleteMany({ where: { email } });
}

export async function login(
  app: INestApplication,
  email = E2E_ADMIN.email,
  password = E2E_ADMIN.password,
): Promise<string> {
  const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login falló: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.accessToken as string;
}

/** Cookie de sesión emitida por el login, lista para `.set('Cookie', ...)`. */
export async function loginCookie(
  app: INestApplication,
  email = E2E_ADMIN.email,
  password = E2E_ADMIN.password,
): Promise<string> {
  const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login falló: ${res.status} ${JSON.stringify(res.body)}`);
  const cookie = sessionCookieOf(res.get('Set-Cookie'));
  if (!cookie) throw new Error('el login no emitió la cookie de sesión');
  return cookie.split(';')[0];
}

/** Devuelve el `Set-Cookie` completo de la cookie de sesión, o undefined. */
export function sessionCookieOf(setCookie: string[] | undefined): string | undefined {
  return setCookie?.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
}

/** Borra restos de corridas anteriores abortadas (nunca datos del seed). */
export async function cleanupE2eLeftovers(prisma: PrismaService): Promise<void> {
  await prisma.experience.deleteMany({ where: { company: 'ACME E2E' } });
  await prisma.skillCategory.deleteMany({
    where: { name: { equals: { es: 'Datos E2E', en: 'Data E2E' } } },
  });
  await prisma.curatedProfile.deleteMany({ where: { slug: 'qa-lead-e2e' } });
}
