/**
 * Seed — carga una fuente de datos bilingüe en la base.
 *
 *   npm run seed                              → docs/cv-data.json (la trayectoria real)
 *   npm run seed -- --file <ruta>             → otro archivo (ruta relativa al directorio actual)
 *   npm run seed:example                      → docs/examples/cv-data.example.json
 *
 * Requiere que las migraciones ya estén aplicadas (`npm run prisma:deploy`).
 * Idempotente: limpia las tablas de contenido antes de insertar. SOBRESCRIBE lo que se haya
 * editado desde el panel.
 *
 * Con `--file` el seed se niega a escribir salvo que la base sea descartable (variable
 * `SEED_DISPOSABLE_DB=1`, `NODE_ENV` distinto de `production` y base vacía o con el mismo
 * perfil): ver `scripts/lib/seed-guard.ts`.
 *
 * Salida: 0 ok · 1 fuente ausente o inválida (no se borra nada) · 2 negativa.
 */
import { PrismaClient } from '@prisma/client';
import { DEFAULT_SEED_FILE, executeSeed, parseSeedArgs, readSeedFile } from './lib/seed-runner';

async function main(): Promise<number> {
  const args = parseSeedArgs(process.argv.slice(2), process.cwd());
  if (!args.ok) {
    console.error(`❌ ${args.error}`);
    return 1;
  }
  const file = args.value.file ?? DEFAULT_SEED_FILE;
  const raw = readSeedFile(file);
  if (!raw.ok) {
    console.error(`❌ ${raw.error}`);
    return 1;
  }

  const prisma = new PrismaClient();
  try {
    return await executeSeed(prisma, raw.value, {
      guarded: args.value.file !== undefined,
      env: process.env,
    });
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((e: unknown) => {
    console.error('❌ Error en seed:', e);
    process.exitCode = 1;
  });
