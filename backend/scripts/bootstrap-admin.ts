/**
 * Bootstrap del administrador del backoffice (spec `admin-authentication`).
 *
 *   npm run admin:bootstrap
 *
 * Lee ADMIN_EMAIL, ADMIN_PASSWORD y ADMIN_NAME del entorno (.env), hashea la contraseña
 * con argon2id y crea o actualiza (upsert por email) el AdminUser. Si ya existe, también cierra
 * las sesiones abiertas (incrementa `sessionVersion`): es la vía de recuperación si se pierde la
 * contraseña.
 * Termina con exit 1 si faltan email o contraseña. Con `NODE_ENV=production` rechaza, antes de
 * tocar la base, la contraseña de ejemplo y las de menos de 12 caracteres. El seed de datos no
 * toca esta tabla.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { runAdminBootstrap } from './lib/bootstrap-admin';

runAdminBootstrap(
  process.env,
  {
    log: (line) => console.log(line),
    warn: (line) => console.warn(line),
    error: (line) => console.error(line),
  },
  {
    // El cliente se construye recién después de validar: un rechazo nunca toca la base.
    createPrisma: () => new PrismaClient(),
    hash: (password) => argon2.hash(password, { type: argon2.argon2id }),
  },
)
  .then((code) => {
    process.exitCode = code;
  })
  .catch((e: unknown) => {
    console.error('❌ Error en bootstrap del administrador:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
