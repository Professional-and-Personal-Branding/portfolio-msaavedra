import { Inject, Injectable } from '@nestjs/common';
import { IntegrationsOverviewOutput } from '../dto/integration-status.output';
import { INTEGRATIONS_SETTINGS, IntegrationsSettings } from '../ports/integrations-settings.port';
import { IntegrationStatusReader } from '../services/integration-status.reader';

/** Estado de todos los proveedores habilitados por `INTEGRATIONS_ENABLED` (D18). */
@Injectable()
export class ListIntegrationsUseCase {
  constructor(
    private readonly reader: IntegrationStatusReader,
    @Inject(INTEGRATIONS_SETTINGS) private readonly config: IntegrationsSettings,
  ) {}

  async execute(): Promise<IntegrationsOverviewOutput> {
    return {
      schedulerEnabled: this.config.schedulerEnabled,
      providers: await this.reader.read(this.config.enabledProviders),
    };
  }
}
