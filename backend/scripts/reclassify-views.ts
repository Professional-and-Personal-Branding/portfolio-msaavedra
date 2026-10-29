/**
 * Reclasifica las visitas existentes (change `classify-profile-views`, D4 y D5).
 *
 *   npm run views:reclassify              → simulación: informa y no escribe
 *   npm run views:reclassify -- --apply   → escribe en una transacción
 *
 * Recalcula `kind` de las filas que no son OWNER con `classifyUserAgent` (la misma regla
 * del registro) y `views` de cada perfil como la cantidad de sus visitas HUMAN. Es idempotente:
 * con la base ya reclasificada no informa cambios. Volver a correrlo después de cada cambio de
 * versión de la lista de bots (`BOT_USER_AGENT_PATTERNS_VERSION`).
 *
 * Salida: 0 ok (también la simulación) · 1 argumento desconocido o falla al leer/escribir.
 */
import { PrismaClient } from '@prisma/client';
import {
  applyReclassification,
  formatReclassificationReport,
  loadProfileRows,
  loadViewRows,
  parseReclassifyArgs,
  planReclassification,
} from './lib/reclassify-views';
import { describeDatabaseTarget } from './lib/seed-guard';

async function main(): Promise<number> {
  const args = parseReclassifyArgs(process.argv.slice(2));
  if (!args.ok) {
    console.error(`❌ ${args.error}`);
    return 1;
  }
  const prisma = new PrismaClient();
  try {
    const [rows, profiles] = await Promise.all([loadViewRows(prisma), loadProfileRows(prisma)]);
    const plan = planReclassification(rows, profiles);
    const report = formatReclassificationReport({
      plan,
      target: describeDatabaseTarget(process.env.DATABASE_URL),
      apply: args.value.apply,
      databaseUrl: process.env.DATABASE_URL,
    });
    console.log(report);
    if (args.value.apply) {
      await applyReclassification(prisma, plan);
      console.log(plan.hasChanges ? '\n✅ Reclasificación aplicada.' : '');
    }
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((e: unknown) => {
    console.error('❌ Error en views:reclassify:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
