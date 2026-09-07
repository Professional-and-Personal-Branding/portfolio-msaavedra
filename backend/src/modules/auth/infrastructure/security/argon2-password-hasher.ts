import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PasswordHasher } from '../../domain/ports/password-hasher.port';

/** argon2id con los parámetros por defecto de la librería (m=65536, t=3, p=4). */
@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      // Hash malformado o de otro algoritmo: nunca lanzar hacia el caso de uso.
      return false;
    }
  }
}
