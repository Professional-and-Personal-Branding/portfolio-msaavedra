import type { PrismaClient } from '@prisma/client';
import {
  PLACEHOLDER_PASSWORD,
  checkBootstrapPassword,
  runAdminBootstrap,
} from '../scripts/lib/bootstrap-admin';

describe('checkBootstrapPassword (spec admin-authentication — bootstrap)', () => {
  it('rechaza la contraseña de ejemplo en producción', () => {
    const result = checkBootstrapPassword(PLACEHOLDER_PASSWORD, 'production');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('ADMIN_PASSWORD');
  });

  it('fuera de producción solo avisa del placeholder', () => {
    const result = checkBootstrapPassword(PLACEHOLDER_PASSWORD, 'development');
    expect(result).toMatchObject({
      ok: true,
      warning: expect.stringContaining('placeholder') as string,
    });
  });

  it('en producción exige 12 caracteres o más', () => {
    const short = checkBootstrapPassword('a'.repeat(10), 'production');
    expect(short.ok).toBe(false);
    expect(!short.ok && short.error).toContain('12');
    expect(checkBootstrapPassword('a'.repeat(12), 'production')).toEqual({ ok: true });
  });

  it('fuera de producción el mínimo sigue en 8', () => {
    expect(checkBootstrapPassword('a'.repeat(7), 'test').ok).toBe(false);
    expect(checkBootstrapPassword('a'.repeat(8), 'test')).toEqual({ ok: true });
  });
});

describe('runAdminBootstrap', () => {
  function setup() {
    const io = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const createPrisma = jest.fn(() => {
      throw new Error('no debería instanciarse');
    }) as unknown as jest.Mock<PrismaClient>;
    const hash = jest.fn();
    return { io, createPrisma, hash };
  }
  const base = { ADMIN_EMAIL: 'a@example.com', NODE_ENV: 'production' };

  it('contraseña de ejemplo en producción: sale con 1 sin instanciar Prisma ni hashear', async () => {
    const { io, createPrisma, hash } = setup();
    const code = await runAdminBootstrap({ ...base, ADMIN_PASSWORD: PLACEHOLDER_PASSWORD }, io, {
      createPrisma,
      hash,
    });
    expect(code).toBe(1);
    expect(createPrisma).not.toHaveBeenCalled();
    expect(hash).not.toHaveBeenCalled();
    expect(io.error).toHaveBeenCalledWith(expect.stringContaining('ADMIN_PASSWORD'));
  });

  it('contraseña corta en producción: sale con 1 sin tocar la base', async () => {
    const { io, createPrisma, hash } = setup();
    const code = await runAdminBootstrap({ ...base, ADMIN_PASSWORD: 'a'.repeat(10) }, io, {
      createPrisma,
      hash,
    });
    expect(code).toBe(1);
    expect(createPrisma).not.toHaveBeenCalled();
  });

  it('faltan variables: sale con 1 y nombra la variable', async () => {
    const { io, createPrisma, hash } = setup();
    const code = await runAdminBootstrap({ ADMIN_EMAIL: 'a@example.com' }, io, {
      createPrisma,
      hash,
    });
    expect(code).toBe(1);
    expect(io.error).toHaveBeenCalledWith(expect.stringContaining('ADMIN_PASSWORD'));
  });

  it('contraseña válida: hashea, hace el upsert y desconecta', async () => {
    const { io, hash } = setup();
    hash.mockResolvedValue('$argon2id$hash-de-prueba');
    const prisma = {
      adminUser: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({
          email: 'a@example.com',
          name: 'Admin',
          sessionVersion: 0,
        }),
      },
      $disconnect: jest.fn().mockResolvedValue(undefined),
    };
    const code = await runAdminBootstrap({ ...base, ADMIN_PASSWORD: 'a'.repeat(16) }, io, {
      createPrisma: () => prisma as unknown as PrismaClient,
      hash,
    });
    expect(code).toBe(0);
    expect(prisma.adminUser.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.$disconnect).toHaveBeenCalled();
  });
});
