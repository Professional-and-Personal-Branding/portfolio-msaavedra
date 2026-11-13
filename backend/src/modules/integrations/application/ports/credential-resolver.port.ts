import { Result } from '../../../../shared/domain/result';
import {
  CredentialMissingError,
  CredentialUnreadableError,
} from '../../domain/errors/integration.errors';

export const CREDENTIAL_RESOLVER = Symbol('CREDENTIAL_RESOLVER');

export type CredentialSource = 'env' | 'db';

export interface ResolvedCredential {
  readonly secret: string;
  readonly source: CredentialSource;
}

export interface CredentialDescription {
  readonly source: CredentialSource | null;
  readonly keyId: string | null;
  readonly updatedAt: Date | null;
}

export interface CredentialResolver {
  /** Variable de entorno primero, base cifrada después (D14). */
  resolve(
    provider: string,
  ): Promise<Result<ResolvedCredential, CredentialMissingError | CredentialUnreadableError>>;
  /** Origen y metadatos, nunca el secreto. */
  describe(provider: string): Promise<CredentialDescription>;
}
