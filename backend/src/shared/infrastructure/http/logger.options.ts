import type { Params } from 'nestjs-pino';
import type { IncomingMessage, ServerResponse } from 'http';
import { randomUUID } from 'crypto';

/**
 * Cabeceras y campos que jamás deben escribirse en el log
 * (spec `api-observability` § Redacción de datos sensibles).
 */
export const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-access-token"]',
  'res.headers["set-cookie"]',
  'req.body.password',
  'req.body.accessToken',
  'req.body.currentPassword',
  'req.body.newPassword',
  'password',
  'accessToken',
  'currentPassword',
  'newPassword',
  // Credenciales de integraciones (change `add-integrations-foundation`, D16).
  'req.body.secret',
  'secret',
  'ciphertext',
  'credential',
  'token',
  // IA (change `add-ai-foundation`, D21): la clave de Anthropic jamás se loguea.
  'req.headers["x-api-key"]',
  'headers["x-api-key"]',
  'apiKey',
  'ANTHROPIC_API_KEY',
];

const TOKEN_QUERY = /([?&]token=)[^&]*/gi;

/** Sustituye el valor de `?token=` por un marcador, conservando el resto de la URL. */
export function redactTokenInUrl(url: string | undefined): string | undefined {
  return url?.replace(TOKEN_QUERY, '$1[Redacted]');
}

/** Rutas que no vale la pena loguear: el orquestador las consulta cada pocos segundos. */
const QUIET_ROUTES = ['/health', '/health/live'];

export function isQuietRoute(url: string | undefined): boolean {
  const path = (url ?? '').split('?')[0];
  return QUIET_ROUTES.includes(path);
}

/**
 * Configuración de `nestjs-pino` (decisión D5). JSON en producción, salida
 * legible en desarrollo, y redacción probada por la propia librería.
 */
export function buildLoggerOptions(level: string, isProduction: boolean): Params {
  return {
    pinoHttp: {
      level,
      // El id ya lo asignó `RequestIdMiddleware`; si no, se genera aquí.
      genReqId: (req: IncomingMessage) => {
        const existing = (req as IncomingMessage & { id?: unknown }).id;
        return typeof existing === 'string' ? existing : randomUUID();
      },
      redact: { paths: REDACTED_PATHS, censor: '[Redacted]' },
      autoLogging: {
        ignore: (req: IncomingMessage) => isQuietRoute(req.url),
      },
      serializers: {
        // Defensivo: pino aplica el serializador a cualquier objeto bajo `req`,
        // que no siempre es una petición HTTP completa.
        req: (req: Partial<{ method: string; url: string; id: string }>) => ({
          id: req.id,
          method: req.method,
          url: redactTokenInUrl(req.url),
        }),
        res: (res: Partial<ServerResponse>) => ({ statusCode: res.statusCode }),
      },
      transport: isProduction
        ? undefined
        : { target: 'pino-pretty', options: { singleLine: true, translateTime: 'HH:MM:ss' } },
    },
  };
}
