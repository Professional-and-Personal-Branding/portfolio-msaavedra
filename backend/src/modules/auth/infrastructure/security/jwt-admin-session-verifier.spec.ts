import { JwtService } from '@nestjs/jwt';
import { SessionRevokedError } from '../../domain/errors/session-revoked.error';
import { fail, ok } from '../../../../shared/domain/result';
import { GetCurrentAdminUseCase } from '../../application/use-cases/get-current-admin.use-case';
import { JwtAdminSessionVerifier } from './jwt-admin-session-verifier';

const SECRET = 'un-secreto-de-prueba-bastante-largo-123';

function build(adminResult: 'found' | 'missing' | 'throws' = 'found') {
  const execute = jest.fn().mockImplementation(() => {
    if (adminResult === 'throws') return Promise.reject(new Error('base caída'));
    return Promise.resolve(
      adminResult === 'found'
        ? ok({ id: 'a1', email: 'a@x.com', name: 'A', sessionVersion: 0 })
        : fail(new SessionRevokedError()),
    );
  });
  const jwt = new JwtService({ secret: SECRET, signOptions: { algorithm: 'HS256' } });
  const verifier = new JwtAdminSessionVerifier(jwt, {
    execute,
  } as unknown as GetCurrentAdminUseCase);
  return { verifier, jwt, execute };
}

describe('JwtAdminSessionVerifier', () => {
  it('token válido de un administrador existente', async () => {
    const { verifier, jwt } = build();
    const token = jwt.sign({ sub: 'a1', email: 'a@x.com', name: 'A' }, { expiresIn: 60 });
    await expect(verifier.isAdminSession(token)).resolves.toBe(true);
  });

  it('token vencido', async () => {
    const { verifier, jwt, execute } = build();
    const token = jwt.sign({ sub: 'a1' }, { expiresIn: -10 });
    await expect(verifier.isAdminSession(token)).resolves.toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it('firmado con otro secreto', async () => {
    const { verifier } = build();
    const forged = new JwtService({ secret: 'otro-secreto-distinto-muy-largo-456' }).sign(
      { sub: 'a1' },
      { expiresIn: 60 },
    );
    await expect(verifier.isAdminSession(forged)).resolves.toBe(false);
  });

  it('alg none', async () => {
    const { verifier } = build();
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'a1', exp: 4_102_444_800 })}.`;
    await expect(verifier.isAdminSession(token)).resolves.toBe(false);
  });

  it('basura que no es un JWT', async () => {
    await expect(build().verifier.isAdminSession('no-es-un-jwt')).resolves.toBe(false);
  });

  it('payload sin sub', async () => {
    const { verifier, jwt, execute } = build();
    await expect(
      verifier.isAdminSession(jwt.sign({ email: 'a@x.com' }, { expiresIn: 60 })),
    ).resolves.toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it('le pasa el sv del token a la verificación compartida (revocado → false)', async () => {
    const { verifier, jwt, execute } = build('missing');
    const token = jwt.sign({ sub: 'a1', sv: 2 }, { expiresIn: 60 });
    await expect(verifier.isAdminSession(token)).resolves.toBe(false);
    expect(execute).toHaveBeenCalledWith({ id: 'a1', sessionVersion: 2 });
  });

  it('un token sin sv se verifica como sessionVersion undefined (vale 0)', async () => {
    const { verifier, jwt, execute } = build('found');
    await expect(verifier.isAdminSession(jwt.sign({ sub: 'a1' }, { expiresIn: 60 }))).resolves.toBe(
      true,
    );
    expect(execute).toHaveBeenCalledWith({ id: 'a1', sessionVersion: undefined });
  });

  it('sub de un administrador inexistente', async () => {
    const { verifier, jwt } = build('missing');
    await expect(verifier.isAdminSession(jwt.sign({ sub: 'a1' }, { expiresIn: 60 }))).resolves.toBe(
      false,
    );
  });

  it('el caso de uso lanza: false, sin propagar', async () => {
    const { verifier, jwt } = build('throws');
    await expect(verifier.isAdminSession(jwt.sign({ sub: 'a1' }, { expiresIn: 60 }))).resolves.toBe(
      false,
    );
  });
});
