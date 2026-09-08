import createClient from 'openapi-fetch';
import type { paths } from '@/shared/types/api';

/**
 * Cliente HTTP tipado por el contrato OpenAPI (spec `api-contract-types`).
 * `VITE_API_URL` vacío → rutas relativas (`/api/...`), que en desarrollo
 * resuelve el proxy de Vite hacia el backend.
 * `credentials: 'include'` para que viaje la cookie de sesión del backoffice
 * (spec `admin-authentication`); las rutas públicas no la necesitan y la ignoran.
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? '';

export const api = createClient<paths>({
  baseUrl: API_BASE_URL,
  credentials: 'include',
  // Resuelve `fetch` en cada llamada (no al importar): permite interceptarlo (MSW) o polyfills tardíos.
  fetch: (input) => globalThis.fetch(input),
});

export type ApiClient = typeof api;

/** Error HTTP con el status, para distinguir 401/404/409 de fallos de red. */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export function isHttpError(error: unknown, status?: number): error is HttpError {
  return error instanceof HttpError && (status === undefined || error.status === status);
}

/** Mensaje de error de la API (`class-validator` puede devolver un array). */
export function apiErrorMessage(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.filter((m) => typeof m === 'string').join('. ');
  }
  return undefined;
}

/** Normaliza la respuesta de `openapi-fetch`: devuelve los datos o lanza `HttpError`. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.data !== undefined) return result.data;
  throw new HttpError(
    result.response.status,
    apiErrorMessage(result.error) ?? result.response.statusText,
  );
}
