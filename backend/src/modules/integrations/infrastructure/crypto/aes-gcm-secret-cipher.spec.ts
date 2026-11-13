import { randomBytes } from 'crypto';
import { AesGcmSecretCipher } from './aes-gcm-secret-cipher';
import { Keyring } from './keyring';

const AAD = 'integration-credential:fake';

function cipherWith(ids: string[], active: string): AesGcmSecretCipher {
  return new AesGcmSecretCipher(
    new Keyring(new Map(ids.map((id) => [id, randomBytes(32)])), active),
  );
}

describe('AesGcmSecretCipher', () => {
  it('ida y vuelta', () => {
    const cipher = cipherWith(['k1'], 'k1');
    const result = cipher.decrypt(cipher.encrypt('mi-token-secreto', AAD), AAD);
    expect(result).toEqual({ ok: true, value: 'mi-token-secreto' });
  });

  it('dos cifrados del mismo texto dan payloads distintos', () => {
    const cipher = cipherWith(['k1'], 'k1');
    expect(cipher.encrypt('igual', AAD)).not.toBe(cipher.encrypt('igual', AAD));
  });

  it('el payload no contiene el texto y lleva el formato v1.<kid>.…', () => {
    const cipher = cipherWith(['k1'], 'k1');
    const payload = cipher.encrypt('texto-en-claro-123', AAD);
    expect(payload).not.toContain('texto-en-claro-123');
    expect(payload).not.toContain(Buffer.from('texto-en-claro-123').toString('base64url'));
    expect(payload.split('.')).toHaveLength(5);
    expect(payload.startsWith('v1.k1.')).toBe(true);
  });

  it('un dato asociado de otro proveedor no descifra, sin lanzar', () => {
    const cipher = cipherWith(['k1'], 'k1');
    const payload = cipher.encrypt('x', AAD);
    const result = cipher.decrypt(payload, 'integration-credential:github');
    expect(result.ok).toBe(false);
  });

  it('un tag alterado no descifra, sin lanzar', () => {
    const cipher = cipherWith(['k1'], 'k1');
    const parts = cipher.encrypt('x', AAD).split('.');
    parts[3] = Buffer.alloc(16, 1).toString('base64url');
    expect(cipher.decrypt(parts.join('.'), AAD).ok).toBe(false);
  });

  it('un texto cifrado alterado no descifra', () => {
    const cipher = cipherWith(['k1'], 'k1');
    const parts = cipher.encrypt('algo-largo-para-alterar', AAD).split('.');
    parts[4] = Buffer.from('otra-cosa-distinta-xx').toString('base64url');
    expect(cipher.decrypt(parts.join('.'), AAD).ok).toBe(false);
  });

  it('un kid desconocido no descifra, y el error no incluye el payload', () => {
    const writer = cipherWith(['k9'], 'k9');
    const reader = cipherWith(['k1'], 'k1');
    const payload = writer.encrypt('x', AAD);
    const result = reader.decrypt(payload, AAD);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).not.toContain(payload);
  });

  it('formatos inválidos no lanzan', () => {
    const cipher = cipherWith(['k1'], 'k1');
    for (const bad of ['', 'basura', 'v2.k1.a.b.c', 'v1.k1.a.b']) {
      expect(cipher.decrypt(bad, AAD).ok).toBe(false);
    }
  });

  it('needsRekey: true con otra clave, false con la activa', () => {
    const keys = new Map([
      ['k1', randomBytes(32)],
      ['k2', randomBytes(32)],
    ]);
    const old = new AesGcmSecretCipher(new Keyring(keys, 'k1'));
    const current = new AesGcmSecretCipher(new Keyring(keys, 'k2'));
    const payload = old.encrypt('x', AAD);
    expect(current.needsRekey(payload)).toBe(true);
    expect(old.needsRekey(payload)).toBe(false);
    expect(current.keyIdOf(payload)).toBe('k1');
    expect(current.decrypt(payload, AAD)).toEqual({ ok: true, value: 'x' });
  });

  it('un keyring vacío no puede cifrar', () => {
    const cipher = new AesGcmSecretCipher(new Keyring(new Map(), ''));
    expect(() => cipher.encrypt('x', AAD)).toThrow(/clave activa/);
  });
});
