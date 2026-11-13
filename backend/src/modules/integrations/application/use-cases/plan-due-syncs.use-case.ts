import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, Clock } from '../../../../shared/domain/clock';
import { isProviderStale } from '../../domain/entities/integration-setting.entity';
import {
  INTEGRATION_JOB_REPOSITORY,
  IntegrationJobRepository,
  PurgeResult,
} from '../../domain/repositories/integration-job.repository';
import {
  INTEGRATION_SETTING_REPOSITORY,
  IntegrationSettingRepository,
} from '../../domain/repositories/integration-setting.repository';
import { INTEGRATIONS_SETTINGS, IntegrationsSettings } from '../ports/integrations-settings.port';
import { RUN_LOGGER_FACTORY, RunLoggerFactory } from '../ports/run-logger.port';

/** Retención (D23): los `DONE` se conservan 30 días; `DEAD` y los `SyncRun`, 90. */
export const RETAIN_DONE_DAYS = 30;
export const RETAIN_DEAD_DAYS = 90;

export interface PlanOutput {
  readonly enqueued: string[];
  readonly purged: PurgeResult;
  readonly stale: string[];
}

/**
 * Planificador diario (D3): encola `sync:<proveedor>:daily:<fecha UTC>` para cada proveedor
 * habilitado (idempotente aunque dos procesos disparen el cron a la vez), aplica la retención
 * y avisa de los proveedores atrasados (D17).
 */
@Injectable()
export class PlanDueSyncsUseCase {
  constructor(
    @Inject(INTEGRATION_JOB_REPOSITORY) private readonly jobs: IntegrationJobRepository,
    @Inject(INTEGRATION_SETTING_REPOSITORY) private readonly settings: IntegrationSettingRepository,
    @Inject(INTEGRATIONS_SETTINGS) private readonly config: IntegrationsSettings,
    @Inject(RUN_LOGGER_FACTORY) private readonly loggers: RunLoggerFactory,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(): Promise<PlanOutput> {
    const now = this.clock.now();
    const log = this.loggers.general();
    const providers = this.config.enabledProviders;
    const enqueued: string[] = [];
    const stale: string[] = [];

    if (providers.length > 0) {
      const settings = await this.settings.getOrCreateMany(providers, now);
      const day = now.toISOString().slice(0, 10);
      for (const provider of providers) {
        const setting = settings.get(provider);
        if (!setting) continue;
        // Pausado a mano: no se encola. El breaker no impide encolar: el reclamo lo respeta.
        if (setting.enabled) {
          const { created } = await this.jobs.enqueue({
            provider,
            kind: 'sync',
            idempotencyKey: `sync:${provider}:daily:${day}`,
            payload: {},
            runAt: now,
          });
          if (created) enqueued.push(provider);
        }
        if (isProviderStale(setting, now)) {
          stale.push(provider);
          log.warn('Integración sin una corrida exitosa hace más de 48 h', {
            provider,
            lastSuccessAt: setting.props.lastSuccessAt?.toISOString() ?? null,
          });
        }
      }
    }

    const purged = await this.jobs.purge(now, RETAIN_DONE_DAYS, RETAIN_DEAD_DAYS);
    return { enqueued, purged, stale };
  }
}
