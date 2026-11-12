import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, Clock } from '../../../../shared/domain/clock';
import { isProviderStale } from '../../domain/entities/integration-setting.entity';
import {
  INTEGRATION_JOB_REPOSITORY,
  IntegrationJobRepository,
} from '../../domain/repositories/integration-job.repository';
import {
  INTEGRATION_SETTING_REPOSITORY,
  IntegrationSettingRepository,
} from '../../domain/repositories/integration-setting.repository';
import {
  SYNC_RUN_REPOSITORY,
  SyncRunRepository,
} from '../../domain/repositories/sync-run.repository';
import { IntegrationStatusOutput } from '../dto/integration-status.output';
import { CREDENTIAL_RESOLVER, CredentialResolver } from '../ports/credential-resolver.port';

const NO_JOBS = { pending: 0, running: 0, failed: 0, dead: 0 };

/**
 * Arma el estado de los proveedores para el panel (D18) con consultas por lote: un `groupBy`
 * de la cola, una por la última corrida y una por la configuración. Nunca llama a un conector.
 */
@Injectable()
export class IntegrationStatusReader {
  constructor(
    @Inject(INTEGRATION_SETTING_REPOSITORY) private readonly settings: IntegrationSettingRepository,
    @Inject(INTEGRATION_JOB_REPOSITORY) private readonly jobs: IntegrationJobRepository,
    @Inject(SYNC_RUN_REPOSITORY) private readonly syncRuns: SyncRunRepository,
    @Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async read(providers: readonly string[]): Promise<IntegrationStatusOutput[]> {
    if (providers.length === 0) return [];
    const now = this.clock.now();
    const [settings, summaries, lastRuns] = await Promise.all([
      this.settings.getOrCreateMany(providers, now),
      this.jobs.summarize(providers),
      this.syncRuns.latestByProvider(providers),
    ]);

    return Promise.all(
      providers.map(async (provider): Promise<IntegrationStatusOutput> => {
        const setting = settings.get(provider);
        if (!setting) throw new Error(`Sin configuración para ${provider}`);
        const summary = summaries.get(provider);
        const run = lastRuns.get(provider);
        const credential = await this.credentials.describe(provider);
        const paused =
          setting.props.pausedUntil !== null && setting.props.pausedUntil.getTime() > now.getTime();
        return {
          provider,
          enabled: setting.props.enabled,
          pausedUntil: paused ? setting.props.pausedUntil!.toISOString() : null,
          pauseReason: paused ? setting.props.pauseReason : null,
          stale: isProviderStale(setting, now),
          lastSuccessAt: setting.props.lastSuccessAt?.toISOString() ?? null,
          lastRun: run
            ? {
                outcome: run.outcome,
                startedAt: run.startedAt.toISOString(),
                finishedAt: run.finishedAt?.toISOString() ?? null,
                errorClass: run.errorClass,
                errorMessage: run.errorMessage,
              }
            : null,
          jobs: summary?.counts ?? NO_JOBS,
          lastDeadError: summary?.lastDeadError ?? null,
          credential: {
            source: credential.source,
            keyId: credential.keyId,
            updatedAt: credential.updatedAt?.toISOString() ?? null,
          },
        };
      }),
    );
  }
}
