import { AdminUser } from './admin-user.entity';

function adminWithVersion(sessionVersion: number): AdminUser {
  return AdminUser.create({
    id: 'a1',
    email: 'a@x.com',
    passwordHash: 'hash',
    name: 'A',
    createdAt: new Date('2026-01-01'),
    lastLoginAt: null,
    sessionVersion,
  });
}

describe('AdminUser.acceptsSession (change add-admin-password-change, D3)', () => {
  it('un token sin sv vale como versión 0', () => {
    expect(adminWithVersion(0).acceptsSession(undefined)).toBe(true);
    expect(adminWithVersion(1).acceptsSession(undefined)).toBe(false);
  });

  it('compara la versión exacta', () => {
    expect(adminWithVersion(0).acceptsSession(1)).toBe(false);
    expect(adminWithVersion(3).acceptsSession(3)).toBe(true);
    expect(adminWithVersion(3).acceptsSession(2)).toBe(false);
  });

  it('rechaza un sv que no es un entero no negativo', () => {
    const admin = adminWithVersion(3);
    expect(admin.acceptsSession(-1)).toBe(false);
    expect(admin.acceptsSession(1.5)).toBe(false);
    expect(admin.acceptsSession('3')).toBe(false);
    expect(admin.acceptsSession(null)).toBe(false);
    expect(admin.acceptsSession(Number.NaN)).toBe(false);
    expect(adminWithVersion(0).acceptsSession(-0.5)).toBe(false);
  });
});
