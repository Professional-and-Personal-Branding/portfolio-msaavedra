import { ExecutionContext, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoginRateLimitGuard } from './login-rate-limit.guard';

function makeConfig(limit = 3, ttl = 60) {
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

describe('LoginRateLimitGuard', () => {
  it('permite los intentos dentro del límite', () => {
    const guard = new LoginRateLimitGuard(makeConfig(3));
    const { context } = makeContext('1.1.1.1');

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('al superarlo responde 429 con Retry-After', () => {
    const guard = new LoginRateLimitGuard(makeConfig(2));
    const { context, setHeader } = makeContext('2.2.2.2');

    guard.canActivate(context);
    guard.canActivate(context);

    expect(() => guard.canActivate(context)).toThrow(HttpException);
    try {
      guard.canActivate(context);
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(429);
    }
    expect(setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('el mensaje no revela si el email existe', () => {
    const guard = new LoginRateLimitGuard(makeConfig(1));
    const { context } = makeContext('3.3.3.3');
    guard.canActivate(context);

    try {
      guard.canActivate(context);
    } catch (error) {
      const message = (error as HttpException).message;
      expect(message).not.toMatch(/email|usuario|contraseña incorrecta/i);
      expect(message).toMatch(/intentos/i);
    }
  });

  it('cuenta por IP: una no afecta a la otra', () => {
    const guard = new LoginRateLimitGuard(makeConfig(1));
    guard.canActivate(makeContext('4.4.4.4').context);

    expect(() => guard.canActivate(makeContext('4.4.4.4').context)).toThrow();
    expect(guard.canActivate(makeContext('5.5.5.5').context)).toBe(true);
  });

  it('la ventana se renueva al vencer', () => {
    jest.useFakeTimers();
    const guard = new LoginRateLimitGuard(makeConfig(1, 60));
    const { context } = makeContext('6.6.6.6');

    guard.canActivate(context);
    expect(() => guard.canActivate(context)).toThrow();

    jest.advanceTimersByTime(61_000);
    expect(guard.canActivate(context)).toBe(true);
    jest.useRealTimers();
  });

  it('una petición sin IP no rompe el guard', () => {
    const guard = new LoginRateLimitGuard(makeConfig(1));
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({}),
        getResponse: () => ({ setHeader: jest.fn() }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });
});
