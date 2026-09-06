import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const ACCESS_TOKEN_HEADER = 'x-access-token';
export const ACCESS_TOKEN_QUERY = 'token';

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].length > 0) return value[0];
  return undefined;
}

/**
 * Token de acceso de un perfil PROTECTED: header `X-Access-Token` y, si falta,
 * query `token` (útil para links compartibles). Devuelve undefined si no hay ninguno.
 */
export function extractAccessToken(req: Request): string | undefined {
  const fromHeader = firstString(req.headers?.[ACCESS_TOKEN_HEADER]);
  if (fromHeader) return fromHeader;
  const query = (req.query ?? {}) as Record<string, unknown>;
  return firstString(query[ACCESS_TOKEN_QUERY]);
}

export const AccessToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined =>
    extractAccessToken(ctx.switchToHttp().getRequest<Request>()),
);
