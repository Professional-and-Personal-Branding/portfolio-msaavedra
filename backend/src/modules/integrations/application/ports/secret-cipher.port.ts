import { Result } from '../../../../shared/domain/result';
import { CredentialUnreadableError } from '../../domain/errors/integration.errors';

export const SECRET_CIPHER = Symbol('SECRET_CIPHER');

/** Cifrado simétrico de credenciales con dato asociado por proveedor (D12). */
export interface SecretCipher {
  readonly activeKeyId: string;
  encrypt(plain: string, aad: string): string;
  decrypt(payload: string, aad: string): Result<string, CredentialUnreadableError>;
  /** `kid` que nombra el payload, o `null` si no tiene el formato esperado. */
  keyIdOf(payload: string): string | null;
  /** ¿Está cifrado con una clave distinta de la activa? */
  needsRekey(payload: string): boolean;
}

/** Dato asociado de la credencial de un proveedor: una copiada a otra fila no descifra. */
export const credentialAad = (provider: string): string => `integration-credential:${provider}`;
