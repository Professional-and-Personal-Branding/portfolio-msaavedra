export const CREDENTIAL_REPOSITORY = Symbol('CREDENTIAL_REPOSITORY');

export interface CredentialRecord {
  readonly provider: string;
  readonly ciphertext: string;
  readonly keyId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CredentialRepository {
  find(provider: string): Promise<CredentialRecord | null>;
  listAll(): Promise<CredentialRecord[]>;
  upsert(provider: string, ciphertext: string, keyId: string): Promise<void>;
  delete(provider: string): Promise<void>;
  /** Para el rekey: reemplaza solo si el `ciphertext` sigue siendo el que se descifró. */
  updateIfUnchanged(
    provider: string,
    oldCiphertext: string,
    newCiphertext: string,
    newKeyId: string,
  ): Promise<boolean>;
}
