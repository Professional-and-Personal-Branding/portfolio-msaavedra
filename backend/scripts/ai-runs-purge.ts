/**
 * Deja en nulo la salida (`AiRun.output`) de las corridas de IA con más de 180 días (change
 * `add-ai-foundation`, P4).
 *
 *   npm run ai-runs:purge             # simulación: cuenta lo que se purgaría
 *   npm run ai-runs:purge -- --apply  # escribe
 *
 * Conserva tarea, versión, modelo, hash de la entrada, tokens, costo y estado: el gasto del mes y la
 * tabla del panel no cambian. Idempotente. Salida: 0 ok · 1 error de base.
 */
import { PrismaClient } from '@prisma/client';
import { PurgeAiRunOutputsUseCase } from '../src/modules/ai/application/use-cases/purge-ai-run-outputs.use-case';
import { PrismaAiRunRepository } from '../src/modules/ai/infrastructure/persistence/prisma-ai-run.repository';
import { BackgroundTasks } from '../src/shared/application/background-tasks';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';

/** El script no registra visitas: no hay nada que drenar. */
const noBackground: BackgroundTasks = {
  run: () => undefined,
  whenIdle: () => Promise.resolve(),
  drain: () => Promise.resolve(),
};

async function main(): Promise<number> {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaService(noBackground);
  try {
    await prisma.$connect();
    const result = await new PurgeAiRunOutputsUseCase(new PrismaAiRunRepository(prisma)).execute({
      now: new Date(),
      apply,
    });
    const label = apply
      ? 'Salidas de IA purgadas'
      : 'Salidas de IA que se purgarían (simulación; usá --apply)';
    console.log(
      `${label}: ${result.affected} (corridas anteriores al ${result.cutoff.toISOString()})`,
    );
    return 0;
  } catch (error) {
    console.error('❌ Error en ai-runs:purge:', error instanceof Error ? error.message : error);
    return 1;
  } finally {
    await (prisma as PrismaClient).$disconnect();
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch(() => {
    process.exitCode = 1;
  });
