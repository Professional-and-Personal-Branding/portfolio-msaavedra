import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '../../../../shared/domain/errors';
import { fail, ok, Result } from '../../../../shared/domain/result';
import {
  CredentialFromEnvError,
  UnknownProviderError,
} from '../../domain/errors/integration.errors';
import {
  CREDENTIAL_REPOSITORY,
  CredentialRepository,
} from '../../domain/repositories/credential.repository';
import { CREDENTIAL_RESOLVER, CredentialResolver } from '../ports/credential-resolver.port';
import { INTEGRATIONS_SETTINGS, IntegrationsSettings } from '../ports/integrations-settings.port';
import { RUN_LOGGER_FACTORY, RunLoggerFactory } from '../ports/run-logger.port';
import { credentialAad, SECRET_CIPHER, SecretCipher } from '../ports/secret-cipher.port';

export const MAX_CREDENTIAL_LENGTH = 4096;

/**
 * Guarda la credencial de un proveedor cifrada (D12, D14). Con una variable de entorno
 * definida para ese proveedor se niega: no puede haber dos fuentes que diverjan.
 */
@Injectable()
export class SaveCredentialUseCase {
  constructor(
    @Inject(CREDENTIAL_REPOSITORY) private readonly credentials: CredentialRepository,
    @Inject(CREDENTIAL_RESOLVER) private readonly resolver: CredentialResolver,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
    @Inject(INTEGRATIONS_SETTINGS) private readonly config: IntegrationsSettings,
    @Inject(RUN_LOGGER_FACTORY) private readonly loggers: RunLoggerFactory,
  ) {}

  async execute(input: {
    provider: string;
    secret: string;
  }): Promise<Result<void, UnknownProviderError | CredentialFromEnvError | ValidationError>> {
    const { provider, secret } = input;
    if (!this.config.enabledProviders.includes(provider)) {
      return fail(new UnknownProviderError(provider));
    }
    if (secret.length === 0 || secret.length > MAX_CREDENTIAL_LENGTH || secret !== secret.trim()) {
      return fail(
        new ValidationError(
          `La credencial debe tener entre 1 y ${MAX_CREDENTIAL_LENGTH} caracteres, sin espacios al borde`,
          ['secret'],
        ),
      );
    }
    if ((await this.resolver.describe(provider)).source === 'env') {
      return fail(new CredentialFromEnvError());
    }
    const ciphertext = this.cipher.encrypt(secret, credentialAad(provider));
    await this.credentials.upsert(provider, ciphertext, this.cipher.activeKeyId);
    this.loggers.general().info('Credencial de integración guardada', {
      provider,
      keyId: this.cipher.activeKeyId,
    });
    return ok(undefined);
  }
}
