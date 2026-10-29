import type { Request } from 'express';
import { ExtractJwt } from 'passport-jwt';
import { extractJwtFromSessionCookie } from './session-cookie';

const fromBearerHeader = ExtractJwt.fromAuthHeaderAsBearerToken();

/**
 * Extractores del token de sesión del panel, en el orden del guard: primero
 * `Authorization: Bearer`, después la cookie `portfolio_session`. `JwtStrategy`
 * y el registro de visitas usan los mismos para que no puedan divergir.
 */
export const adminTokenExtractors = [fromBearerHeader, extractJwtFromSessionCookie];

/** Lee el token sin validarlo; `null` si la petición no trae ninguno. */
export function extractAdminToken(req: Request): string | null {
  for (const extract of adminTokenExtractors) {
    const token = extract(req);
    if (token) return token;
  }
  return null;
}
