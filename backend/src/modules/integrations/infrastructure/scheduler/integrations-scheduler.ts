import { Inject, Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import type { IntegrationsConfig } from '../../../../config/configuration';
import { BACKGROUND_TASKS, BackgroundTasks } from '../../../../shared/application/background-tasks';
import { RUN_LOGGER_FACTORY, RunLoggerFactory } from '../../application/ports/run-logger.port';
import { PlanDueSyncsUseCase } from '../../application/use-cases/plan-due-syncs.use-case';
import { RunDueJobsUseCase } from '../../application/use-cases/run-due-jobs.use-case';

export const INTEGRATIONS_CONFIG = Symbol('INTEGRATIONS_CONFIG');

const PLAN_JOB = 'integrations-plan';
const RUN_INTERVAL = 'integrations-run';

/** Señal de apagado compartida entre el planificador, el ejecutor y el hook de apagado (D6). */
@Injectable()
export class ShutdownSignal {
  private readonly controller = new AbortController();

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  abort(): void {
    this.controller.abort();
  }
}

/**
 * Registra a mano el cron del planificador y el intervalo del ejecutor (D2). Sin
 * `INTEGRATIONS_SCHEDULER_ENABLED=true` no hay ningún timer. Los callbacks nunca esperan al
 * trabajo: lanzan la corrida en `BackgroundTasks` y vuelven (D3).
 */
@Injectable()
export class IntegrationsScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private running = false;

  constructor(
    private readonly registry: SchedulerRegistry,
    @Inject(INTEGRATIONS_CONFIG) private readonly config: IntegrationsConfig,
    private readonly plan: PlanDueSyncsUseCase,
    private readonly run: RunDueJobsUseCase,
    @Inject(BACKGROUND_TASKS) private readonly background: BackgroundTasks,
    private readonly shutdown: ShutdownSignal,
    @Inject(RUN_LOGGER_FACTORY) private readonly loggers: RunLoggerFactory,
  ) {}

  onApplicationBootstrap(): void {
    const log = this.loggers.general();
    if (!this.config.schedulerEnabled) {
      log.info('Integraciones: scheduler apagado');
      return;
    }
    const cron = CronJob.from({
      cronTime: this.config.syncCron,
      onTick: () => this.planTick(),
      start: false,
      timeZone: 'UTC',
    });
    this.registry.addCronJob(PLAN_JOB, cron);
    cron.start();

    const interval = setInterval(() => this.tick(), this.config.tickSeconds * 1000);
    // Los timers no retienen el proceso al apagar (D5).
    interval.unref();
    this.registry.addInterval(RUN_INTERVAL, interval);

    log.info(
      `Integraciones: scheduler encendido (proveedores: ${this.config.enabledProviders.join(', ') || 'ninguno'})`,
    );
  }

  /** Callback del intervalo: vuelve en microsegundos; si ya hay una corrida, se descarta. */
  tick(): void {
    if (this.running) return;
    this.running = true;
    this.background.run('integrations-run', async () => {
      try {
        await this.run.execute({ shutdown: this.shutdown.signal });
      } finally {
        this.running = false;
      }
    });
  }

  /** Callback del cron diario. */
  planTick(): void {
    this.background.run('integrations-plan', async () => {
      await this.plan.execute();
    });
  }

  /** Detiene los timers (idempotente). */
  stopTimers(): void {
    if (this.registry.doesExist('cron', PLAN_JOB)) this.registry.deleteCronJob(PLAN_JOB);
    if (this.registry.doesExist('interval', RUN_INTERVAL)) {
      this.registry.deleteInterval(RUN_INTERVAL);
    }
  }

  onModuleDestroy(): void {
    this.stopTimers();
  }
}
