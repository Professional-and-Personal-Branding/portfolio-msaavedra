/**
 * Corre UNA vez el ejecutor de integraciones y termina (change `add-integrations-foundation`,
 * D20). Herramienta manual para diagnosticar un proveedor sin esperar al tick del scheduler y
 * sin ningún servicio aparte: arranca un contexto de Nest SIN HTTP (no abre ningún puerto) y
 * usa el mismo arriendo del ejecutor que el scheduler.
 *
 *   npm run integrations:sync                          → corre lo que esté vencido
 *   npm run integrations:sync -- --provider fake       → antes, encola un trabajo manual
 *   npm run integrations:sync -- --plan                → antes, corre el planificador diario
 *
 * `INTEGRATIONS_SCHEDULER_ENABLED` se ignora (aquí nunca hay timers).
 * Salida: 0 la corrida terminó (aunque algún trabajo haya quedado FAILED y reintente) ·
 * 1 algún trabajo quedó DEAD en esta corrida · 2 configuración inválida, argumento desconocido,
 * proveedor no habilitado o el arriendo lo tiene otra instancia.
 */
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { EnqueueSyncUseCase } from '../src/modules/integrations/application/use-cases/enqueue-sync.use-case';
import { PlanDueSyncsUseCase } from '../src/modules/integrations/application/use-cases/plan-due-syncs.use-case';
import { RunDueJobsUseCase } from '../src/modules/integrations/application/use-cases/run-due-jobs.use-case';

interface SyncArgs {
  readonly provider?: string;
  readonly plan: boolean;
}

function parseArgs(argv: readonly string[]): SyncArgs | string {
  let provider: string | undefined;
  let plan = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--plan') plan = true;
    else if (arg === '--provider') {
      provider = argv[++i];
      if (!provider || provider.startsWith('--')) return '--provider necesita un id de proveedor';
    } else {
      return `Argumento desconocido: ${arg}. Uso: npm run integrations:sync [-- --provider <id>] [-- --plan]`;
    }
  }
  return { provider, plan };
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (typeof args === 'string') {
    console.error(`❌ ${args}`);
    return 2;
  }
  // Nunca timers en esta herramienta: una sola corrida.
  process.env.INTEGRATIONS_SCHEDULER_ENABLED = 'false';

  let app: INestApplicationContext;
  try {
    app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  } catch (error) {
    console.error(
      `❌ Configuración inválida: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 2;
  }
  try {
    if (args.plan) {
      const planned = await app.get(PlanDueSyncsUseCase).execute();
      console.log(
        `Planificador: encolados ${planned.enqueued.length} (${planned.enqueued.join(', ') || 'ninguno'}), atrasados ${planned.stale.length}.`,
      );
    }
    if (args.provider) {
      const queued = await app.get(EnqueueSyncUseCase).execute({ provider: args.provider });
      if (!queued.ok) {
        console.error(`❌ ${queued.error.message}`);
        return 2;
      }
      console.log(
        `Trabajo manual: ${queued.value.alreadyQueued ? 'ya había uno en cola' : 'encolado'} (${queued.value.jobId}).`,
      );
    }
    const summary = await app.get(RunDueJobsUseCase).execute();
    if (!summary.leased) {
      console.error('❌ El arriendo del ejecutor lo tiene otra instancia: no se ejecutó nada.');
      return 2;
    }
    console.log(
      `Corrida: ${summary.processed} trabajos (hechos ${summary.done}, con error y reintento ${summary.failed}, muertos ${summary.dead}, interrumpidos ${summary.interrupted}).`,
    );
    return summary.dead > 0 ? 1 : 0;
  } finally {
    await app.close();
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((e: unknown) => {
    console.error('❌ Error en integrations:sync:', e instanceof Error ? e.message : e);
    process.exitCode = 2;
  });
