import type { Request } from 'express';
import {
  buildClearSessionCookieOptions,
  buildSessionCookieOptions,
  extractJwtFromSessionCookie,
  SESSION_COOKIE_NAME,
} from './session-cookie';

const requestWith = (cookies: Record<string, unknown> | undefined): Request =>
  ({ cookies }) as unknown as Request;

describe('session-cookie', () => {
  describe('buildSessionCookieOptions', () => {
    it('es httpOnly, SameSite=Lax y con la caducidad del token en milisegundos', () => {
      expect(buildSessionCookieOptions(86400, false)).toEqual({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false,
        maxAge: 86_400_000,
      });
    });

    it('marca `secure` solo en producción', () => {
      expect(buildSessionCookieOptions(60, true).secure).toBe(true);
      expect(buildSessionCookieOptions(60, false).secure).toBe(false);
    });

    it('acepta la política SameSite configurada', () => {
      expect(buildSessionCookieOptions(60, true, 'strict').sameSite).toBe('strict');
      expect(buildSessionCookieOptions(60, false, 'lax').sameSite).toBe('lax');
    });

    it('`SameSite=None` fuerza `Secure` aunque no sea producción', () => {
      const options = buildSessionCookieOptions(60, false, 'none');
      expect(options.sameSite).toBe('none');
      expect(options.secure).toBe(true);
    });
  });

  describe('buildClearSessionCookieOptions', () => {
    it('coincide con las de emisión salvo la caducidad', () => {
      const clear = buildClearSessionCookieOptions(true);
      expect(buildClearSessionCookieOptions(false, 'strict').sameSite).toBe('strict');
      expect(clear).toEqual({ httpOnly: true, sameSite: 'lax', path: '/', secure: true });
      expect(clear).not.toHaveProperty('maxAge');
    });
  });

  describe('extractJwtFromSessionCookie', () => {
    it('devuelve el token de la cookie de sesión', () => {
      expect(extractJwtFromSessionCookie(requestWith({ [SESSION_COOKIE_NAME]: 'jwt.abc' }))).toBe(
        'jwt.abc',
      );
    });

    it('devuelve null sin cookies, con otra cookie, vacía o de tipo inesperado', () => {
      expect(extractJwtFromSessionCookie(requestWith(undefined))).toBeNull();
      expect(extractJwtFromSessionCookie(requestWith({}))).toBeNull();
      expect(extractJwtFromSessionCookie(requestWith({ otra: 'x' }))).toBeNull();
      expect(extractJwtFromSessionCookie(requestWith({ [SESSION_COOKIE_NAME]: '' }))).toBeNull();
      expect(extractJwtFromSessionCookie(requestWith({ [SESSION_COOKIE_NAME]: 42 }))).toBeNull();
    });
  });
});
