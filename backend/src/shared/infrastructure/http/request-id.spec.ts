import type { NextFunction, Request, Response } from 'express';
import { getRequestId, REQUEST_ID_HEADER, requestIdMiddleware } from './request-id';

function run(headers: Record<string, string | string[]> = {}) {
  const req = { headers } as unknown as Request;
  const setHeader = jest.fn();
  const res = { setHeader } as unknown as Response;
  const next = jest.fn() as unknown as NextFunction;

  requestIdMiddleware(req, res, next);
  return { req, setHeader, next };
}

describe('requestIdMiddleware', () => {
  it('genera un id cuando el cliente no lo envía y lo devuelve en la cabecera', () => {
    const { req, setHeader, next } = run();
    const id = getRequestId(req);

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, id);
    expect(next).toHaveBeenCalled();
  });

  it('respeta el id que envía el cliente', () => {
    const { req, setHeader } = run({ 'x-request-id': 'abc-123' });

    expect(getRequestId(req)).toBe('abc-123');
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'abc-123');
  });

  it('descarta ids con formato sospechoso y genera uno propio', () => {
    for (const malicioso of ['con espacios', 'salto\nlinea', 'a'.repeat(200), '']) {
      const { req } = run({ 'x-request-id': malicioso });
      expect(getRequestId(req)).not.toBe(malicioso);
      expect(getRequestId(req)).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it('con varias cabeceras usa la primera', () => {
    const { req } = run({ 'x-request-id': ['primera', 'segunda'] });
    expect(getRequestId(req)).toBe('primera');
  });

  it('getRequestId devuelve undefined si el middleware no corrió', () => {
    expect(getRequestId({})).toBeUndefined();
    expect(getRequestId(undefined)).toBeUndefined();
    expect(getRequestId({ id: 42 })).toBeUndefined();
  });
});
