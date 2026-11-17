import { permanent, ProviderFailure, resetAt, retryAfter, transient } from '../../../../shared/domain/provider-failure/provider-failure';

export interface HttpFailureInput {
  /** Ausente si no hubo respuesta (red caída, timeout, DNS). */
  readonly status?: number;
  readonly headers?: Readonly<Record<string, string | undefined>>;
  readonly body?: unknown;
  readonly networkError?: boolean;
  readonly now?: Date;
}

function header(headers: HttpFailureInput['headers'], name: string): string | undefined {
  if (!headers) return undefined;
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return value;
  }
  return undefined;
}

/** `Retry-After` en segundos o como fecha HTTP; devuelve segundos (≥ 1) o `undefined`. */
function retryAfterSeconds(value: string | undefined, now: Date): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) ? Math.max(1, seconds) : undefined;
  }
  const date = Date.parse(trimmed);
  if (!Number.isFinite(date)) return undefined;
  return Math.max(1, Math.ceil((date - now.getTime()) / 1000));
}

function backoffOf(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const backoff = (body as { backoff?: unknown }).backoff;
  return typeof backoff === 'number' && Number.isFinite(backoff) && backoff > 0
    ? Math.ceil(backoff)
    : undefined;
}

const TRANSIENT_STATUSES = new Set([408, 425, 500, 502, 503, 504]);

/**
 * Clasificación genérica de un fallo HTTP para los adaptadores (D9). Pura: no lee relojes
 * salvo el `now` que se le pasa.
 */
export function classifyHttpFailure(input: HttpFailureInput): ProviderFailure {
  const now = input.now ?? new Date();
  if (input.networkError === true || input.status === undefined) {
    return transient('error de red o timeout');
  }
  const status = input.status;
  const label = `HTTP ${status}`;

  const backoff = backoffOf(input.body);
  if (backoff !== undefined) return retryAfter(backoff, `${label}: el proveedor pidió esperar`);

  if (status === 429) {
    const seconds = retryAfterSeconds(header(input.headers, 'retry-after'), now);
    if (seconds !== undefined) return retryAfter(seconds, `${label}: límite de peticiones`);
  }
  if (status === 429 || status === 403) {
    const remaining = header(input.headers, 'x-ratelimit-remaining');
    const reset = Number(header(input.headers, 'x-ratelimit-reset'));
    if (
      remaining === '0' &&
      Number.isFinite(reset) &&
      reset > 0 &&
      Number.isFinite(new Date(reset * 1000).getTime())
    ) {
      return resetAt(new Date(reset * 1000), `${label}: límite agotado hasta el reinicio`);
    }
  }
  if (status === 429) return transient(`${label}: límite de peticiones sin pistas`);
  if (TRANSIENT_STATUSES.has(status) || status >= 500) return transient(label);
  return permanent(label);
}
