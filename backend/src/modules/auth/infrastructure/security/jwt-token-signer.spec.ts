import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtTokenSigner } from './jwt-token-signer';

describe('JwtTokenSigner', () => {
  it('firma sub, email, name y el claim sv con la versión de sesión', async () => {
    const jwt = new JwtService({ secret: 'un-secreto-de-prueba-bastante-largo-123' });
    const config = {
      getOrThrow: () => ({ jwt: { expiresInSeconds: 3600 } }),
    } as unknown as ConfigService;
    const signer = new JwtTokenSigner(jwt, config);

    const { token, expiresInSeconds } = await signer.sign({
      sub: 'a1',
      email: 'a@x.com',
      name: 'A',
      sessionVersion: 5,
    });

    const payload = jwt.decode<Record<string, unknown>>(token);
    expect(payload).toMatchObject({ sub: 'a1', email: 'a@x.com', name: 'A', sv: 5 });
    expect(expiresInSeconds).toBe(3600);
  });
});
