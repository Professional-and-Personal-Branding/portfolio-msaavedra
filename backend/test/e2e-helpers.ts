/**
 * Utilidades compartidas por los e2e de Fase 3: app de pruebas, administrador
 * efímero (creado en beforeAll y borrado en afterAll) y login.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { GLOBAL_PREFIX } from '../src/app.constants';
import { AppModule } from '../src/app.module';
import { Argon2PasswordHasher } from '../src/modules/auth/infrastructure/security/argon2-password-hasher';
import { SESSION_COOKIE_NAME } from '../src/modules/auth/infrastructure/security/session-cookie';
import { buildCorsOptions } from '../src/shared/infrastructure/http/cors.options';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';
import { setupSwagger } from '../src/swagger';

export const FRONTEND_URL = 'http://localhost:5173';
export const E2E_ADMIN = {
  email: 'e2e-admin@test.local',
  password: 'E2E-pass-123!',
  name: 'E2E Admin',
};

export async function createTestApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.enableCors(buildCorsOptions(FRONTEND_URL));
  setupSwagger(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
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
