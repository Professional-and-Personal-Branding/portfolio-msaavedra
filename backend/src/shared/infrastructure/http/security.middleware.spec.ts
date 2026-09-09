import type { NextFunction, Request, Response } from 'express';
import { httpsRedirect } from './security.middleware';

function run(isProduction: boolean, headers: Record<string, string | string[]> = {}) {
  const req = {
    headers: { host: 'api.example.com', ...headers },
    originalUrl: '/api/profile',
  } as unknown as Request;
  const redirect = jest.fn();
  const res = { redirect } as unknown as Response;
  const next = jest.fn() as unknown as NextFunction;

  httpsRedirect(isProduction)(req, res, next);
  return { redirect, next };
}

describe('httpsRedirect', () => {
  it('en producción redirige una petición http con 301 a la misma ruta', () => {
    const { redirect, next } = run(true, { 'x-forwarded-proto': 'http' });

    expect(redirect).toHaveBeenCalledWith(301, 'https://api.example.com/api/profile');
    expect(next).not.toHaveBeenCalled();
  });

  it('deja pasar lo que ya viene por https', () => {
    const { redirect, next } = run(true, { 'x-forwarded-proto': 'https' });

    expect(redirect).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('con varios saltos usa el primer protocolo de la lista', () => {
    expect(run(true, { 'x-forwarded-proto': 'http, https' }).redirect).toHaveBeenCalled();
    expect(run(true, { 'x-forwarded-proto': 'https, http' }).next).toHaveBeenCalled();
  });

  it('sin la cabecera asume que el proxy resolvió el TLS', () => {
    const { redirect, next } = run(true);

    expect(redirect).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('fuera de producción nunca redirige', () => {
    const { redirect, next } = run(false, { 'x-forwarded-proto': 'http' });

    expect(redirect).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
