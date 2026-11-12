import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, Clock } from '../../../../shared/domain/clock';
import { fail, ok, Result } from '../../../../shared/domain/result';
import {
  ProviderDisabledError,
  UnknownProviderError,
} from '../../domain/errors/integration.errors';
import {
  INTEGRATION_JOB_REPOSITORY,
  IntegrationJobRepository,
} from '../../domain/repositories/integration-job.repository';
import {
  INTEGRATION_SETTING_REPOSITORY,
  IntegrationSettingRepository,
} from '../../domain/repositories/integration-setting.repository';
import { EnqueueSyncOutput } from '../dto/integration-status.output';
import { INTEGRATIONS_SETTINGS, IntegrationsSettings } from '../ports/integrations-settings.port';

/**
 * «Sincronizar ahora» (D3): solo encola. Dos consultas cortas y nunca llama al conector; el
 * trabajo corre en el próximo tick del ejecutor.
 */
@Injectable()
export class EnqueueSyncUseCase {
  constructor(
    @Inject(INTEGRATION_JOB_REPOSITORY) private readonly jobs: IntegrationJobRepository,
    @Inject(INTEGRATION_SETTING_REPOSITORY) private readonly settings: IntegrationSettingRepository,
    @Inject(INTEGRATIONS_SETTINGS) private readonly config: IntegrationsSettings,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(input: {
    provider: string;
  }): Promise<Result<EnqueueSyncOutput, UnknownProviderError | ProviderDisabledError>> {
    const { provider } = input;
    if (!this.config.enabledProviders.includes(provider)) {
      return fail(new UnknownProviderError(provider));
    }
    const now = this.clock.now();
    const setting = await this.settings.getOrCreate(provider, now);
    if (!setting.enabled) return fail(new ProviderDisabledError(provider));

    const active = await this.jobs.findActiveByProvider(provider);
    if (active) return ok(toOutput(active.id, active.status, active.props.runAt, true));

    // Dos clics en el mismo minuto chocan en la clave de idempotencia.
    const minute = now.toISOString().slice(0, 16);
    const { job, created } = await this.jobs.enqueue({
      provider,
      kind: 'sync',
      idempotencyKey: `sync:${provider}:manual:${minute}`,
      payload: {},
      runAt: now,
    });
    return ok(toOutput(job.id, job.status, job.props.runAt, !created));
  }
}

function toOutput(
  jobId: string,
  status: string,
  runAt: Date,
  alreadyQueued: boolean,
): EnqueueSyncOutput {
  return { jobId, status, runAt: runAt.toISOString(), alreadyQueued };
}
