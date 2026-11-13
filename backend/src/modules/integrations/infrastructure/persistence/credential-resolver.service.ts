import { Inject, Injectable } from '@nestjs/common';
import { fail, ok, Result } from '../../../../shared/domain/result';
import {
  CredentialDescription,
  CredentialResolver,
  ResolvedCredential,
} from '../../application/ports/credential-resolver.port';
import {
  credentialAad,
  SECRET_CIPHER,
  SecretCipher,
} from '../../application/ports/secret-cipher.port';
import {
  CredentialMissingError,
  CredentialUnreadableError,
} from '../../domain/errors/integration.errors';
import { PROVIDER_CATALOG } from '../../domain/provider-catalog';
import {
  CREDENTIAL_REPOSITORY,
  CredentialRepository,
} from '../../domain/repositories/credential.repository';

/**
 * Variable de entorno primero, base cifrada después (D14). La variable se lee al resolver, no
 * al arrancar: así un cambio de origen se ve sin reiniciar y los tests la controlan.
 */
@Injectable()
export class CredentialResolverService implements CredentialResolver {
  constructor(
    @Inject(CREDENTIAL_REPOSITORY) private readonly credentials: CredentialRepository,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
  ) {}

  private fromEnv(provider: string): string | undefined {
    const name = PROVIDER_CATALOG[provider]?.secretEnv;
    const value = name ? process.env[name] : undefined;
    return value !== undefined && value.trim() !== '' ? value : undefined;
  }

  async resolve(
    provider: string,
  ): Promise<Result<ResolvedCredential, CredentialMissingError | CredentialUnreadableError>> {
    const fromEnv = this.fromEnv(provider);
    if (fromEnv !== undefined) return ok({ secret: fromEnv, source: 'env' });
    const stored = await this.credentials.find(provider);
    if (!stored) return fail(new CredentialMissingError());
    const plain = this.cipher.decrypt(stored.ciphertext, credentialAad(provider));
    return plain.ok ? ok({ secret: plain.value, source: 'db' }) : fail(plain.error);
  }

  async describe(provider: string): Promise<CredentialDescription> {
    if (this.fromEnv(provider) !== undefined) {
      return { source: 'env', keyId: null, updatedAt: null };
    }
    const stored = await this.credentials.find(provider);
    return stored
      ? { source: 'db', keyId: stored.keyId, updatedAt: stored.updatedAt }
      : { source: null, keyId: null, updatedAt: null };
  }
}
