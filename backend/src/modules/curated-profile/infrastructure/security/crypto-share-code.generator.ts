import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ShareCodeGenerator } from '../../application/ports/share-code.generator';
import { encodeShareCode, SHARE_CODE_LENGTH } from '../../domain/services/share-code';

/** 10 bytes de `crypto.randomBytes` → 10 símbolos (los 5 bits bajos de cada byte, sin sesgo). */
@Injectable()
export class CryptoShareCodeGenerator implements ShareCodeGenerator {
  generate(): string {
    return encodeShareCode(randomBytes(SHARE_CODE_LENGTH));
  }
}
