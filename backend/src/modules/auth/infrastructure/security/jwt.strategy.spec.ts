import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fail, ok } from '../../../../shared/domain/result';
import { NotFoundError } from '../../../../shared/domain/errors';
import { GetCurrentAdminUseCase } from '../../application/use-cases/get-current-admin.use-case';
import { JwtStrategy } from './jwt.strategy';

function build(found: boolean) {
  const config = {
    getOrThrow: () => ({ jwt: { secret: 'un-secreto-de-prueba-largo' } }),
  } as unknown as ConfigService;
  const useCase = {
    execute: jest
      .fn()
      .mockResolvedValue(
        found
          ? ok({ id: 'a1', email: 'a@x.com', name: 'A' })
          : fail(new NotFoundError('Administrador', 'a1')),
      ),
  } as unknown as GetCurrentAdminUseCase;
  return new JwtStrategy(config, useCase);
}

describe('JwtStrategy.validate', () => {
  it('devuelve el admin cuando existe', async () => {
    await expect(build(true).validate({ sub: 'a1', email: 'a@x.com', name: 'A' })).resolves.toEqual(
      { id: 'a1', email: 'a@x.com', name: 'A' },
    );
  });

  it('admin inexistente o payload sin sub → Unauthorized', async () => {
    await expect(build(false).validate({ sub: 'a1', email: '', name: '' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(build(true).validate({ sub: '', email: '', name: '' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
