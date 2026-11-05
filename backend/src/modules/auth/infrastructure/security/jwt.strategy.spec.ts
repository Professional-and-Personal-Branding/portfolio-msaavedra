import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fail, ok } from '../../../../shared/domain/result';
import { GetCurrentAdminUseCase } from '../../application/use-cases/get-current-admin.use-case';
import { SessionRevokedError } from '../../domain/errors/session-revoked.error';
import { JwtStrategy } from './jwt.strategy';

function build(valid: boolean) {
  const config = {
    getOrThrow: () => ({ jwt: { secret: 'un-secreto-de-prueba-largo' } }),
  } as unknown as ConfigService;
  const execute = jest
    .fn()
    .mockResolvedValue(
      valid
        ? ok({ id: 'a1', email: 'a@x.com', name: 'A', sessionVersion: 0 })
        : fail(new SessionRevokedError()),
    );
  const strategy = new JwtStrategy(config, { execute } as unknown as GetCurrentAdminUseCase);
  return { strategy, execute };
}

describe('JwtStrategy.validate', () => {
  it('devuelve el admin (con la versión) cuando la sesión vale', async () => {
    const { strategy } = build(true);
    await expect(
      strategy.validate({ sub: 'a1', email: 'a@x.com', name: 'A', sv: 0 }),
    ).resolves.toEqual({ id: 'a1', email: 'a@x.com', name: 'A', sessionVersion: 0 });
  });

  it('le pasa el sv del token al caso de uso, sin interpretarlo', async () => {
    const { strategy, execute } = build(true);
    await strategy.validate({ sub: 'a1', email: '', name: '', sv: 4 });
    expect(execute).toHaveBeenLastCalledWith({ id: 'a1', sessionVersion: 4 });
    await strategy.validate({ sub: 'a1', email: '', name: '' });
    expect(execute).toHaveBeenLastCalledWith({ id: 'a1', sessionVersion: undefined });
  });

  it('sesión revocada o payload sin sub → Unauthorized', async () => {
    await expect(
      build(false).strategy.validate({ sub: 'a1', email: '', name: '', sv: 0 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      build(true).strategy.validate({ sub: '', email: '', name: '' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
