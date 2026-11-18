/**
 * Núcleo del bootstrap del administrador (change `add-admin-password-change`, D10): el upsert
 * vive aparte del script para poder probarlo. Crear deja `sessionVersion` en 0; actualizar la
 * incrementa para cerrar las sesiones abiertas, igual que el cambio de contraseña del panel.
 */
import type { PrismaClient } from '@prisma/client';

export interface BootstrapAdminInput {
  readonly email: string;
  readonly passwordHash: string;
  readonly name: string;
}

export async function upsertAdminUser(
  prisma: PrismaClient,
  input: BootstrapAdminInput,
): Promise<{ created: boolean; email: string; name: string; sessionVersion: number }> {
  const { email, passwordHash, name } = input;
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  const admin = await prisma.adminUser.upsert({
    where: { email },
    create: { email, passwordHash, name },
    update: { passwordHash, name, sessionVersion: { increment: 1 } },
  });
  return {
    created: !existing,
    email: admin.email,
    name: admin.name,
    sessionVersion: admin.sessionVersion,
  };
}

/** Contraseña de `.env.example`: en producción no se acepta. */
export const PLACEHOLDER_PASSWORD = 'cambiar-en-primer-arranque';
const MIN_PASSWORD = 8;
/** En producción, igual que el cambio de contraseña desde **Cuenta** (`prepare-deploy-1-0-0`, D5). */
const MIN_PASSWORD_PRODUCTION = 12;

export type PasswordCheck =
  { readonly ok: true; readonly warning?: string } | { readonly ok: false; readonly error: string };

/**
 * Reglas de la contraseña del bootstrap (D3 y D5). Pura: no toca la base. Con
 * `NODE_ENV=production` rechaza la contraseña de ejemplo y las de menos de 12 caracteres; fuera de
 * producción solo avisa del placeholder (el `.env` local nace con él) y exige 8.
 */
export function checkBootstrapPassword(
  password: string,
  nodeEnv: string | undefined,
): PasswordCheck {
  const production = nodeEnv === 'production';
  if (production && password === PLACEHOLDER_PASSWORD) {
    return {
      ok: false,
      error: 'ADMIN_PASSWORD es el valor de ejemplo de .env.example: en producción no se acepta',
    };
  }
  const min = production ? MIN_PASSWORD_PRODUCTION : MIN_PASSWORD;
  if (password.length < min) {
    return {
      ok: false,
      error: `ADMIN_PASSWORD debe tener al menos ${min} caracteres${production ? ' en producción' : ''}.`,
    };
  }
  if (password === PLACEHOLDER_PASSWORD) {
    return {
      ok: true,
      warning: 'ADMIN_PASSWORD es el placeholder de .env.example; cambiala antes de producción.',
    };
  }
  return { ok: true };
}

export interface BootstrapIo {
  readonly log: (line: string) => void;
  readonly warn: (line: string) => void;
  readonly error: (line: string) => void;
}

export interface BootstrapDeps {
  readonly createPrisma: () => PrismaClient;
  readonly hash: (password: string) => Promise<string>;
}

/**
 * Núcleo de `npm run admin:bootstrap`. Valida el entorno y la contraseña ANTES de construir el
 * cliente de Prisma: un rechazo (código 1) nunca toca la base.
 */
export async function runAdminBootstrap(
  env: NodeJS.ProcessEnv,
  io: BootstrapIo,
  deps: BootstrapDeps,
): Promise<number> {
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.ADMIN_PASSWORD;
  const name = env.ADMIN_NAME?.trim() || 'Admin';

  const missing = [!email && 'ADMIN_EMAIL', !password && 'ADMIN_PASSWORD'].filter(Boolean);
  if (missing.length > 0 || !email || !password) {
    io.error(`❌ Faltan variables de entorno: ${missing.join(', ')}`);
    return 1;
  }
  const check = checkBootstrapPassword(password, env.NODE_ENV);
  if (!check.ok) {
    io.error(`❌ ${check.error}`);
    return 1;
  }
  if (check.warning) io.warn(`⚠️  ${check.warning}`);

  const prisma = deps.createPrisma();
  try {
    const passwordHash = await deps.hash(password);
    const admin = await upsertAdminUser(prisma, { email, passwordHash, name });
    io.log(
      `✅ Administrador ${admin.created ? 'creado' : 'actualizado (sesiones abiertas cerradas)'}: ${admin.email} (${admin.name}) — hash ${passwordHash.slice(0, 10)}…`,
    );
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}
