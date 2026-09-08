import type { CookieOptions, Request } from 'express';

/**
 * Cookie de sesión del backoffice (spec `admin-authentication`, decisión D1 de
 * `add-admin-backoffice`). El JWT viaja en una cookie `httpOnly` para que el
 * panel no tenga que guardarlo en JavaScript (CLAUDE.md prohíbe
 * `localStorage`/`sessionStorage` para auth). El header `Authorization: Bearer`
 * sigue siendo válido para curl, Swagger y los e2e.
 */
export const SESSION_COOKIE_NAME = 'portfolio_session';

const BASE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
};

/**
 * `secure` solo en producción: en desarrollo el navegador ve un único origen
 * (el proxy de Vite) sobre http, donde una cookie `Secure` no se guardaría.
 */
export function buildSessionCookieOptions(
  expiresInSeconds: number,
  isProduction: boolean,
): CookieOptions {
  return { ...BASE_OPTIONS, secure: isProduction, maxAge: expiresInSeconds * 1000 };
}

/** Opciones para borrar la cookie: deben coincidir con las de emisión salvo la caducidad. */
export function buildClearSessionCookieOptions(isProduction: boolean): CookieOptions {
  return { ...BASE_OPTIONS, secure: isProduction };
}

/** Extractor de passport-jwt: lee el token de la cookie de sesión. */
export function extractJwtFromSessionCookie(req: Request): string | null {
  const cookies: unknown = (req as Request & { cookies?: unknown }).cookies;
  if (typeof cookies !== 'object' || cookies === null) return null;
  const token: unknown = (cookies as Record<string, unknown>)[SESSION_COOKIE_NAME];
  return typeof token === 'string' && token.length > 0 ? token : null;
}
