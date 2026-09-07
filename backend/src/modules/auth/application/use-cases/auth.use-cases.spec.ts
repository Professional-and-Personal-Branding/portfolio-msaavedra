import { AdminUser } from '../../domain/entities/admin-user.entity';
import { InvalidCredentialsError } from '../../domain/errors/invalid-credentials.error';
import { PasswordHasher } from '../../domain/ports/password-hasher.port';
import { TokenSigner } from '../../domain/ports/token-signer.port';
import { AdminUserRepository } from '../../domain/repositories/admin-user.repository';
import { GetCurrentAdminUseCase } from './get-current-admin.use-case';
import { LoginUseCase } from './login.use-case';

const ADMIN = AdminUser.create({
  id: 'a1',
  email: 'Admin@Test.local',
  passwordHash: '$argon2id$hash',
  name: 'Admin',
  createdAt: new Date('2026-01-01'),
  lastLoginAt: null,
});

function deps(found: AdminUser | null = ADMIN, verifyResult = true) {
  const admins: AdminUserRepository = {
    findByEmail: jest.fn().mockResolvedValue(found),
    findById: jest.fn().mockResolvedValue(found),
    upsert: jest.fn(),
    touchLastLogin: jest.fn().mockResolvedValue(undefined),
  };
  const hasher: PasswordHasher = {
    hash: jest.fn(),
    verify: jest.fn().mockResolvedValue(verifyResult),
  };
  const signer: TokenSigner = {
    sign: jest.fn().mockResolvedValue({ token: 'jwt.token.here', expiresInSeconds: 86400 }),
  };
  return { admins, hasher, signer };
}

describe('LoginUseCase (spec admin-authentication)', () => {
  it('credenciales válidas → token, expiresIn y usuario sin hash; actualiza lastLoginAt', async () => {
    const d = deps();
    const result = await new LoginUseCase(d.admins, d.hasher, d.signer).execute({
      email: '  ADMIN@test.local ',
      password: 'secret',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      accessToken: 'jwt.token.here',
      tokenType: 'Bearer',
      expiresIn: 86400,
      user: { id: 'a1', email: 'admin@test.local', name: 'Admin' },
    });
    expect(JSON.stringify(result.value)).not.toContain('argon2');
    expect(d.admins.findByEmail).toHaveBeenCalledWith('admin@test.local');
    expect(d.hasher.verify).toHaveBeenCalledWith('$argon2id$hash', 'secret');
    expect(d.admins.touchLastLogin).toHaveBeenCalledWith('a1', expect.any(Date));
    expect(d.signer.sign).toHaveBeenCalledWith({
      sub: 'a1',
      email: 'admin@test.local',
      name: 'Admin',
    });
  });

  it('email inexistente y contraseña incorrecta producen el mismo error', async () => {
    const noUser = deps(null);
    const badPass = deps(ADMIN, false);
    const r1 = await new LoginUseCase(noUser.admins, noUser.hasher, noUser.signer).execute({
      email: 'x@x.com',
      password: 'p',
    });
    const r2 = await new LoginUseCase(badPass.admins, badPass.hasher, badPass.signer).execute({
      email: 'admin@test.local',
      password: 'wrong',
    });
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    if (r1.ok || r2.ok) return;
    expect(r1.error).toBeInstanceOf(InvalidCredentialsError);
    expect(r2.error).toBeInstanceOf(InvalidCredentialsError);
    expect(r1.error.message).toBe(r2.error.message);
    expect(badPass.admins.touchLastLogin).not.toHaveBeenCalled();
    expect(badPass.signer.sign).not.toHaveBeenCalled();
  });
});

describe('GetCurrentAdminUseCase', () => {
  it('devuelve el admin sin hash; inexistente → NotFound', async () => {
    const d = deps();
    const ok = await new GetCurrentAdminUseCase(d.admins).execute({ id: 'a1' });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value).toEqual({ id: 'a1', email: 'admin@test.local', name: 'Admin' });

    const none = deps(null);
    const missing = await new GetCurrentAdminUseCase(none.admins).execute({ id: 'zz' });
    expect(missing.ok).toBe(false);
  });
});
