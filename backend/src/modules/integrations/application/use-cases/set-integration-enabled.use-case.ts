import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, Clock } from '../../../../shared/domain/clock';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { UnknownProviderError } from '../../domain/errors/integration.errors';
import {
  INTEGRATION_SETTING_REPOSITORY,
  IntegrationSettingRepository,
} from '../../domain/repositories/integration-setting.repository';
import { IntegrationStatusOutput } from '../dto/integration-status.output';
import { INTEGRATIONS_SETTINGS, IntegrationsSettings } from '../ports/integrations-settings.port';
import { IntegrationStatusReader } from '../services/integration-status.reader';

/**
 * Kill switch por proveedor sin redeploy (D11). Pausar no cancela un trabajo en curso: impide
 * reclamar los siguientes y que el planificador encole.
 */
@Injectable()
export class SetIntegrationEnabledUseCase {
  constructor(
    @Inject(INTEGRATION_SETTING_REPOSITORY) private readonly settings: IntegrationSettingRepository,
    private readonly reader: IntegrationStatusReader,
    @Inject(INTEGRATIONS_SETTINGS) private readonly config: IntegrationsSettings,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(input: {
    provider: string;
    enabled: boolean;
  }): Promise<Result<IntegrationStatusOutput, UnknownProviderError>> {
    const { provider, enabled } = input;
    if (!this.config.enabledProviders.includes(provider)) {
      return fail(new UnknownProviderError(provider));
    }
    const now = this.clock.now();
    const current = await this.settings.getOrCreate(provider, now);
    const next = current.withEnabled(enabled, now);
    if (next !== current) await this.settings.saveEnabled(next);
    const [status] = await this.reader.read([provider]);
    return ok(status);
  }
}
