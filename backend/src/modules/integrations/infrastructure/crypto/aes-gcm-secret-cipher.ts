import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { SecretCipher } from '../../application/ports/secret-cipher.port';
import { CredentialUnreadableError } from '../../domain/errors/integration.errors';
import { Keyring } from './keyring';

const VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * AES-256-GCM con keyring (D12). Formato `v1.<kid>.<iv>.<tag>.<ct>` en base64url. El dato
 * asociado (`integration-credential:<proveedor>`) liga el cifrado al proveedor: una credencial
 * copiada a la fila de otro no descifra. Descifrar nunca lanza: devuelve `CredentialUnreadableError`
 * sin tocar el payload en el mensaje.
 */
export class AesGcmSecretCipher implements SecretCipher {
  constructor(private readonly keyring: Keyring) {}

  get activeKeyId(): string {
    return this.keyring.activeKeyId;
  }

  encrypt(plain: string, aad: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.keyring.active(), iv);
    cipher.setAAD(Buffer.from(aad, 'utf-8'));
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf-8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      VERSION,
      this.keyring.activeKeyId,
      iv.toString('base64url'),
      tag.toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  }

  decrypt(payload: string, aad: string): Result<string, CredentialUnreadableError> {
    const parts = payload.split('.');
    if (parts.length !== 5 || parts[0] !== VERSION) return fail(new CredentialUnreadableError());
    const [, keyId, ivText, tagText, ctText] = parts;
    const key = this.keyring.get(keyId);
    if (!key) return fail(new CredentialUnreadableError());
    try {
      const iv = Buffer.from(ivText, 'base64url');
      const tag = Buffer.from(tagText, 'base64url');
      if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
        return fail(new CredentialUnreadableError());
      }
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAAD(Buffer.from(aad, 'utf-8'));
      decipher.setAuthTag(tag);
      const plain = Buffer.concat([
        decipher.update(Buffer.from(ctText, 'base64url')),
        decipher.final(),
      ]);
      return ok(plain.toString('utf-8'));
    } catch {
      return fail(new CredentialUnreadableError());
    }
  }

  keyIdOf(payload: string): string | null {
    const parts = payload.split('.');
    return parts.length === 5 && parts[0] === VERSION ? parts[1] : null;
  }

  needsRekey(payload: string): boolean {
    return this.keyIdOf(payload) !== this.activeKeyId;
  }
}
