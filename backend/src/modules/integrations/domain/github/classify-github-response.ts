import { ProviderFailure, permanent, resetAt, retryAfter } from '../../../../shared/domain/provider-failure/provider-failure';
import { classifyHttpFailure } from '../services/classify-http-failure';

/** Reserva de cuota (D7): con tantas peticiones o menos por delante, el trabajo se detiene. */
export const GITHUB_RATE_RESERVE = 50;

/** «Al menos un minuto» que pide GitHub ante un límite secundario sin pistas (D6). */
export const SECONDARY_LIMIT_WAIT_SECONDS = 60;

export const TOKEN_REJECTED_MESSAGE =
  'GitHub rechazó el token (401): renovalo en Integraciones o en GITHUB_SYNC_TOKEN';

export interface GithubResponseLike {
  readonly status: number;
  /** Cabeceras con el nombre en minúsculas. */
  readonly headers: Readonly<Record<string, string | undefined>>;
  /** Cuerpo ya interpretado (JSON) o `undefined`; solo se mira `message`. */
  readonly body?: unknown;
}

/** Estado de un repositorio que NO detiene el trabajo (D6). */
export type GithubRepoProblem = 'NOT_FOUND' | 'INACCESSIBLE';

export type GithubVerdict =
  | { readonly kind: 'data' }
  | { readonly kind: 'notModified' }
  | { readonly kind: 'repo'; readonly status: GithubRepoProblem; readonly reason: string }
  | { readonly kind: 'job'; readonly failure: ProviderFailure };

const REDIRECTS = new Set([301, 302, 307, 308]);

function messageOf(body: unknown): string {
  if (typeof body !== 'object' || body === null) return '';
  const message = (body as { message?: unknown }).message;
  return typeof message === 'string' ? message : '';
}

/** `retry-after` en segundos o fecha HTTP; segundos ≥ 1 o `undefined`. */
function retryAfterSeconds(value: string | undefined, now: Date): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Math.max(1, Number(trimmed));
  const date = Date.parse(trimmed);
  return Number.isFinite(date) ? Math.max(1, Math.ceil((date - now.getTime()) / 1000)) : undefined;
}

/** `x-ratelimit-reset` (epoch en segundos) como fecha, o `undefined` si no sirve. */
function resetDate(headers: GithubResponseLike['headers']): Date | undefined {
  const reset = Number(headers['x-ratelimit-reset']);
  if (!Number.isFinite(reset) || reset <= 0) return undefined;
  const date = new Date(reset * 1000);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

/**
 * Clasifica una respuesta de GitHub (D6). Separa lo que detiene el TRABAJO (un `ProviderFailure`)
 * de lo que es el ESTADO de un repositorio (el trabajo sigue con el siguiente). Pura. Para lo
 * genérico reusa `classifyHttpFailure`; el mensaje nunca incluye cabeceras ni el cuerpo.
 */
export function classifyGithubResponse(response: GithubResponseLike, now: Date): GithubVerdict {
  const { status, headers } = response;
  if (status === 200) return { kind: 'data' };
  if (status === 304) return { kind: 'notModified' };
  if (status === 401) return { kind: 'job', failure: permanent(TOKEN_REJECTED_MESSAGE) };

  if (status === 403 || status === 429) {
    const seconds = retryAfterSeconds(headers['retry-after'], now);
    if (seconds !== undefined) {
      return {
        kind: 'job',
        failure: retryAfter(seconds, `HTTP ${status}: GitHub pidió esperar (límite de peticiones)`),
      };
    }
    const reset = resetDate(headers);
    if (headers['x-ratelimit-remaining'] === '0' && reset !== undefined) {
      return {
        kind: 'job',
        failure: resetAt(reset, `HTTP ${status}: límite de GitHub agotado hasta el reinicio`),
      };
    }
    if (status === 429 || /rate limit/i.test(messageOf(response.body))) {
      return {
        kind: 'job',
        failure: retryAfter(
          SECONDARY_LIMIT_WAIT_SECONDS,
          `HTTP ${status}: límite secundario de GitHub, se espera un minuto`,
        ),
      };
    }
    return { kind: 'repo', status: 'INACCESSIBLE', reason: `HTTP ${status}` };
  }

  if (status === 404 || status === 410) {
    return { kind: 'repo', status: 'NOT_FOUND', reason: `HTTP ${status}` };
  }
  if (status === 451) return { kind: 'repo', status: 'INACCESSIBLE', reason: 'HTTP 451' };
  if (REDIRECTS.has(status)) {
    return { kind: 'repo', status: 'INACCESSIBLE', reason: 'GitHub redirigió fuera de la API' };
  }
  return { kind: 'job', failure: classifyHttpFailure({ status, now }) };
}

/**
 * Reserva de cuota (D7): con `x-ratelimit-remaining` ≤ 50 y `x-ratelimit-reset`, el trabajo se
 * detiene con `ResetAt` ANTES de la siguiente petición. `null` si se puede seguir.
 */
export function quotaReserveFailure(
  headers: GithubResponseLike['headers'],
  reserve: number = GITHUB_RATE_RESERVE,
): ProviderFailure | null {
  const text = headers['x-ratelimit-remaining'];
  if (text === undefined || text.trim() === '') return null;
  const remaining = Number(text);
  const reset = resetDate(headers);
  if (!Number.isFinite(remaining) || remaining > reserve || reset === undefined) return null;
  return resetAt(
    reset,
    `Cuota de GitHub casi agotada (quedan ${remaining}): se pausa hasta el reinicio`,
  );
}
