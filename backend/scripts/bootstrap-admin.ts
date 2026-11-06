/**
 * Bootstrap del administrador del backoffice (spec `admin-authentication`).
 *
 *   npm run admin:bootstrap
 *
 * Lee ADMIN_EMAIL, ADMIN_PASSWORD y ADMIN_NAME del entorno (.env), hashea la contraseña
 * con argon2id y crea o actualiza (upsert por email) el AdminUser. Si ya existe, también cierra
 * las sesiones abiertas (incrementa `sessionVersion`): es la vía de recuperación si se pierde la
 * contraseña.
 * Termina con exit 1 si faltan email o contraseña. El seed de datos no toca esta tabla.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { upsertAdminUser } from './lib/bootstrap-admin';

const PLACEHOLDER_PASSWORD = 'cambiar-en-primer-arranque';

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Admin';

  const missing = [!email && 'ADMIN_EMAIL', !password && 'ADMIN_PASSWORD'].filter(Boolean);
  if (missing.length > 0 || !email || !password) {
    console.error(`❌ Faltan variables de entorno: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (password === PLACEHOLDER_PASSWORD) {
    console.warn(
      '⚠️  ADMIN_PASSWORD es el placeholder de .env.example; cambiala antes de producción.',
    );
  }
  if (password.length < 8) {
    console.error('❌ ADMIN_PASSWORD debe tener al menos 8 caracteres.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const admin = await upsertAdminUser(prisma, { email, passwordHash, name });
    console.log(
      `✅ Administrador ${admin.created ? 'creado' : 'actualizado (sesiones abiertas cerradas)'}: ${admin.email} (${admin.name}) — hash ${passwordHash.slice(0, 10)}…`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error('❌ Error en bootstrap del administrador:', e instanceof Error ? e.message : e);
  process.exit(1);
});
