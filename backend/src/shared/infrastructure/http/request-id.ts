import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'X-Request-Id';

/** Formato aceptado para un id que viene del cliente: evita inyectar basura en los logs. */
const SAFE_ID = /^[A-Za-z0-9._-]{1,128}$/;

interface WithRequestId {
  id?: unknown;
}

/**
 * Identificador de petición (spec `api-observability`). Se toma de la cabecera
 * `X-Request-Id` si el cliente la envía y es razonable; si no, se genera.
 *
 * Queda en `req.id`, que es también lo que lee `pino-http`. Se registra con
 * `app.use()` **antes** que el logger: si corriera después, pino generaría su
 * propio id y el log no se podría cruzar con la respuesta.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
  const id = candidate && SAFE_ID.test(candidate) ? candidate : randomUUID();

  (req as Request & WithRequestId).id = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}

/** Lee el id ya asignado; devuelve `undefined` si el middleware no corrió. */
export function getRequestId(req: unknown): string | undefined {
  const id = (req as WithRequestId | undefined)?.id;
  return typeof id === 'string' ? id : undefined;
}
