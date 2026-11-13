import { Inject, Injectable } from '@nestjs/common';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { UnknownProviderError } from '../../domain/errors/integration.errors';
import {
  CREDENTIAL_REPOSITORY,
  CredentialRepository,
} from '../../domain/repositories/credential.repository';
import { INTEGRATIONS_SETTINGS, IntegrationsSettings } from '../ports/integrations-settings.port';
import { RUN_LOGGER_FACTORY, RunLoggerFactory } from '../ports/run-logger.port';

/** Borra la credencial guardada en la base. Idempotente: sin fila, no hace nada. */
@Injectable()
export class DeleteCredentialUseCase {
  constructor(
    @Inject(CREDENTIAL_REPOSITORY) private readonly credentials: CredentialRepository,
    @Inject(INTEGRATIONS_SETTINGS) private readonly config: IntegrationsSettings,
    @Inject(RUN_LOGGER_FACTORY) private readonly loggers: RunLoggerFactory,
  ) {}

  async execute(input: { provider: string }): Promise<Result<void, UnknownProviderError>> {
    if (!this.config.enabledProviders.includes(input.provider)) {
      return fail(new UnknownProviderError(input.provider));
    }
    await this.credentials.delete(input.provider);
    this.loggers.general().info('Credencial de integración borrada', { provider: input.provider });
    return ok(undefined);
  }
}
