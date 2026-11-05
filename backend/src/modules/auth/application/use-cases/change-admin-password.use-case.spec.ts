import { ValidationError } from '../../../../shared/domain/errors';
import { AdminUser } from '../../domain/entities/admin-user.entity';
import { InvalidCurrentPasswordError } from '../../domain/errors/invalid-current-password.error';
import { SessionRevokedError } from '../../domain/errors/session-revoked.error';
import { PasswordHasher } from '../../domain/ports/password-hasher.port';
import { TokenSigner } from '../../domain/ports/token-signer.port';
import { AdminUserRepository } from '../../domain/repositories/admin-user.repository';
import { ChangeAdminPasswordUseCase } from './change-admin-password.use-case';

function admin(sessionVersion: number): AdminUser {
  return AdminUser.create({
    id: 'a1',
    email: 'admin@test.local',
    passwordHash: '$argon2id$viejo',
    name: 'Admin',
    createdAt: new Date('2026-01-01'),
    lastLoginAt: null,
    sessionVersion,
  });
}

function build(options: {
  found?: AdminUser | null;
  verify?: boolean;
  updated?: AdminUser | null;
}) {
  const found = options.found === undefined ? admin(3) : options.found;
  const updated = options.updated === undefined ? admin(4) : options.updated;
  const admins: AdminUserRepository = {
    findByEmail: jest.fn(),
    findById: jest.fn().mockResolvedValue(found),
    upsert: jest.fn(),
    touchLastLogin: jest.fn(),
    changePassword: jest.fn().mockResolvedValue(updated),
  };
  const hasher: PasswordHasher = {
    hash: jest.fn().mockResolvedValue('$argon2id$nuevo'),
    verify: jest.fn().mockResolvedValue(options.verify ?? true),
  };
  const signer: TokenSigner = {
    sign: jest.fn().mockResolvedValue({ token: 'jwt.nuevo', expiresInSeconds: 86400 }),
  };
  return {
    admins,
    hasher,
    signer,
    useCase: new ChangeAdminPasswordUseCase(admins, hasher, signer),
  };
}

const INPUT = {
  adminId: 'a1',
  sessionVersion: 3,
  currentPassword: 'la-actual-de-prueba',
  newPassword: 'una-nueva-bien-larga',
};

describe('ChangeAdminPasswordUseCase (change add-admin-password-change, D5)', () => {
  it('éxito: guarda el hash nuevo con la versión esperada y firma con la versión +1', async () => {
    const d = build({});
    const result = await d.useCase.execute(INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      accessToken: 'jwt.nuevo',
      tokenType: 'Bearer',
      expiresIn: 86400,
      user: { id: 'a1', email: 'admin@test.local', name: 'Admin' },
    });
    expect(d.hasher.verify).toHaveBeenCalledWith('$argon2id$viejo', INPUT.currentPassword);
    expect(d.hasher.hash).toHaveBeenCalledWith(INPUT.newPassword);
    expect(d.admins.changePassword).toHaveBeenCalledWith('a1', '$argon2id$nuevo', 3);
    expect(d.signer.sign).toHaveBeenCalledWith({
      sub: 'a1',
      email: 'admin@test.local',
      name: 'Admin',
      sessionVersion: 4,
    });
  });

  it('versión de sesión distinta → SessionRevokedError sin verificar nada', async () => {
    const d = build({});
    const result = await d.useCase.execute({ ...INPUT, sessionVersion: 2 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(SessionRevokedError);
    expect(d.hasher.verify).not.toHaveBeenCalled();
    expect(d.admins.changePassword).not.toHaveBeenCalled();
  });

  it('administrador inexistente → SessionRevokedError', async () => {
    const d = build({ found: null });
    const result = await d.useCase.execute(INPUT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(SessionRevokedError);
  });

  it('actual incorrecta → InvalidCurrentPasswordError sin hashear ni escribir', async () => {
    const d = build({ verify: false });
    const result = await d.useCase.execute(INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(InvalidCurrentPasswordError);
    expect(d.hasher.hash).not.toHaveBeenCalled();
    expect(d.admins.changePassword).not.toHaveBeenCalled();
    expect(d.signer.sign).not.toHaveBeenCalled();
  });

  it.each([
    ['corta', 'corta'],
    ['igual a la actual', INPUT.currentPassword],
  ])('nueva %s → ValidationError sin hashear ni escribir', async (_name, newPassword) => {
    const d = build({});
    const result = await d.useCase.execute({ ...INPUT, newPassword });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
    expect(d.hasher.hash).not.toHaveBeenCalled();
    expect(d.admins.changePassword).not.toHaveBeenCalled();
  });

  it('la actual se verifica antes que la política (una incorrecta no revela si la nueva es igual)', async () => {
    const d = build({ verify: false });
    const result = await d.useCase.execute({ ...INPUT, newPassword: INPUT.currentPassword });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(InvalidCurrentPasswordError);
  });

  it('la escritura condicional no actualizó nada (carrera) → SessionRevokedError sin firmar', async () => {
    const d = build({ updated: null });
    const result = await d.useCase.execute(INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(SessionRevokedError);
    expect(d.signer.sign).not.toHaveBeenCalled();
  });

  it('no toca lastLoginAt', async () => {
    const d = build({});
    await d.useCase.execute(INPUT);
    expect(d.admins.touchLastLogin).not.toHaveBeenCalled();
  });
});
