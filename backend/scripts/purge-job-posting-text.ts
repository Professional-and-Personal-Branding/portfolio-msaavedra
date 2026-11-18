/**
 * Borra el texto de las vacantes importadas con más de 90 días (change `add-job-posting-intake`).
 *
 *   npm run job-postings:purge             → simulación: cuenta las vencidas y no escribe
 *   npm run job-postings:purge -- --apply  → purga
 *
 * Conserva título, empresa, ubicación, modalidad, URLs, fechas y los términos detectados; solo
 * pone `description` en nulo. Sin `--apply` simula (cuenta y no escribe). Idempotente.
 * Salida: 0 ok · 1 error de base.
 */
import { PrismaClient } from '@prisma/client';
import { BackgroundTasks } from '../src/shared/application/background-tasks';
import { PrismaJobPostingRepository } from '../src/modules/job-posting/infrastructure/persistence/prisma-job-posting.repository';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';
import { runJobPostingPurge } from './lib/purge-job-posting-text';

/** El script no registra visitas: no hay nada que drenar. */
const noBackground: BackgroundTasks = {
  run: () => undefined,
  whenIdle: () => Promise.resolve(),
  drain: () => Promise.resolve(),
};

async function main(): Promise<number> {
  const prisma = new PrismaService(noBackground);
  try {
    await prisma.$connect();
    return await runJobPostingPurge(
      new PrismaJobPostingRepository(prisma),
      new Date(),
      { apply: process.argv.includes('--apply') },
      {
        log: (line) => console.log(line),
        error: (line) => console.error(`❌ ${line}`),
      },
    );
  } catch (error) {
    console.error(
      '❌ Error en job-postings:purge:',
      error instanceof Error ? error.message : error,
    );
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
