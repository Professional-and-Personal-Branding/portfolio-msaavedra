import { ExecutionContext, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoginRateLimitGuard } from './login-rate-limit.guard';
import { PasswordChangeRateLimitGuard } from './password-change-rate-limit.guard';

function makeConfig(limit = 5, ttl = 60) {
  return {
    getOrThrow: () => ({ throttle: { ttl, limit: 120, loginLimit: limit } }),
  } as unknown as ConfigService;
}

function makeContext(ip: string) {
  const setHeader = jest.fn();
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ ip }),
      getResponse: () => ({ setHeader }),
    }),
  } as unknown as ExecutionContext;
  return { context, setHeader };
}

describe('PasswordChangeRateLimitGuard (change add-admin-password-change, D8)', () => {
  it('el sexto intento responde 429 con Retry-After y el mensaje propio', () => {
    const guard = new PasswordChangeRateLimitGuard(makeConfig(5));
    const { context, setHeader } = makeContext('1.1.1.1');

    for (let i = 0; i < 5; i += 1) expect(guard.canActivate(context)).toBe(true);

    let thrown: HttpException | undefined;
    try {
      guard.canActivate(context);
    } catch (error) {
      thrown = error as HttpException;
    }
    expect(thrown?.getStatus()).toBe(429);
    expect(thrown?.message).toBe(
      'Demasiados intentos de cambio de contraseña. Probá de nuevo en unos minutos.',
    );
    expect(setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('su contador es independiente del login, en los dos sentidos', () => {
    const config = makeConfig(2);
    const login = new LoginRateLimitGuard(config);
    const change = new PasswordChangeRateLimitGuard(config);
    const { context } = makeContext('2.2.2.2');

    login.canActivate(context);
    login.canActivate(context);
    expect(() => login.canActivate(context)).toThrow(HttpException);
    expect(change.canActivate(context)).toBe(true);
    expect(change.canActivate(context)).toBe(true);
    expect(() => change.canActivate(context)).toThrow(HttpException);

    const other = makeContext('3.3.3.3').context;
    expect(change.canActivate(other)).toBe(true);
  });

  it('la ventana se renueva al vencer', () => {
    jest.useFakeTimers();
    const guard = new PasswordChangeRateLimitGuard(makeConfig(1, 60));
    const { context } = makeContext('4.4.4.4');
    guard.canActivate(context);
    expect(() => guard.canActivate(context)).toThrow();
    jest.advanceTimersByTime(61_000);
    expect(guard.canActivate(context)).toBe(true);
    jest.useRealTimers();
  });
});
