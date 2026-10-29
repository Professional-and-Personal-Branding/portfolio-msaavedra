import type { Request } from 'express';
import { extractAdminToken } from './extract-admin-token';
import { SESSION_COOKIE_NAME } from './session-cookie';

const requestWith = (headers: Record<string, string>, cookies?: Record<string, string>): Request =>
  ({ headers, cookies }) as unknown as Request;

describe('extractAdminToken', () => {
  it('solo el header Bearer', () => {
    expect(extractAdminToken(requestWith({ authorization: 'Bearer token-header' }))).toBe(
      'token-header',
    );
  });

  it('solo la cookie de sesión', () => {
    expect(extractAdminToken(requestWith({}, { [SESSION_COOKIE_NAME]: 'token-cookie' }))).toBe(
      'token-cookie',
    );
  });

  it('con los dos gana el header (mismo orden que el guard)', () => {
    const req = requestWith(
      { authorization: 'Bearer token-header' },
      { [SESSION_COOKIE_NAME]: 'token-cookie' },
    );
    expect(extractAdminToken(req)).toBe('token-header');
  });

  it('sin ninguno devuelve null, también con otro esquema de autorización', () => {
    expect(extractAdminToken(requestWith({}))).toBeNull();
    expect(extractAdminToken(requestWith({ authorization: 'Basic abc' }))).toBeNull();
    expect(extractAdminToken(requestWith({}, { otra: 'x' }))).toBeNull();
  });
});
