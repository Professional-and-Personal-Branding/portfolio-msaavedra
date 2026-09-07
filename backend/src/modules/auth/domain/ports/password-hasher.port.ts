export const PASSWORD_HASHER = Symbol('PasswordHasher');

/** Puerto de hashing de contraseñas (implementación: argon2id en infraestructura). */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}
