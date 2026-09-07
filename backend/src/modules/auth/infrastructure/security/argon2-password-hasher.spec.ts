import { Argon2PasswordHasher } from './argon2-password-hasher';

describe('Argon2PasswordHasher (spec admin-authentication — hash)', () => {
  const hasher = new Argon2PasswordHasher();

  it('produce hash argon2id que no contiene la contraseña y verifica correctamente', async () => {
    const hash = await hasher.hash('Portfolio-2026!');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('Portfolio-2026!');
    expect(await hasher.verify(hash, 'Portfolio-2026!')).toBe(true);
    expect(await hasher.verify(hash, 'portfolio-2026!')).toBe(false);
  });

  it('dos hashes de la misma contraseña difieren (sal) y un hash malformado no lanza', async () => {
    const a = await hasher.hash('x');
    const b = await hasher.hash('x');
    expect(a).not.toBe(b);
    expect(await hasher.verify('no-es-un-hash', 'x')).toBe(false);
  });
});
