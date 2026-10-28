/**
 * Seed — carga una fuente de datos bilingüe en la base.
 *
 *   npm run seed                              → docs/cv-data.json, solo sobre una base vacía
 *   npm run seed -- --overwrite               → ídem, aunque la base tenga contenido (lo borra)
 *   npm run seed -- --file <ruta>             → otro archivo (ruta relativa al directorio actual)
 *   npm run seed:example                      → docs/examples/cv-data.example.json
 *
 * Requiere que las migraciones ya estén aplicadas (`npm run prisma:deploy`).
 * Limpia las tablas de contenido antes de insertar: SOBRESCRIBE lo editado desde el panel.
 *
 * Sin `--file` cuenta primero las filas de las 13 tablas que limpia. Con todas en cero, carga.
 * Con alguna fila se niega (código 2) y no escribe nada, salvo `--overwrite`; con
 * `NODE_ENV=production` además exige `SEED_ALLOW_PRODUCTION=1`, definida solo para el comando
 * (nunca como variable del servicio). `--overwrite` no se combina con `--file`.
 * Si no se puede contar (base sin migrar, sin conexión) sale con 1 sin borrar.
 *
 * Con `--file` el seed se niega a escribir salvo que la base sea descartable (variable
 * `SEED_DISPOSABLE_DB=1`, `NODE_ENV` distinto de `production` y base vacía o con el mismo
 * perfil): ver `scripts/lib/seed-guard.ts`.
 *
 * Salida: 0 ok · 1 fuente ausente o inválida, error de uso o falla al contar (no se borra
 * nada) · 2 negativa.
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
      overwrite: args.value.overwrite,
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
