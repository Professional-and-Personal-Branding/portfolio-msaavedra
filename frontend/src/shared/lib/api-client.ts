import createClient from 'openapi-fetch';
import type { paths } from '@/shared/types/api';

/**
 * Cliente HTTP tipado por el contrato OpenAPI (spec `api-contract-types`).
 * `VITE_API_URL` vacío → rutas relativas (`/api/...`), que en desarrollo
 * resuelve el proxy de Vite hacia el backend.
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? '';

export const api = createClient<paths>({
  baseUrl: API_BASE_URL,
  // Resuelve `fetch` en cada llamada (no al importar): permite interceptarlo (MSW) o polyfills tardíos.
  fetch: (input) => globalThis.fetch(input),
});

export type ApiClient = typeof api;
