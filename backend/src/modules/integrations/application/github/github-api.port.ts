import { Result } from '../../../../shared/domain/result';
import { ProviderFailure } from '../../../../shared/domain/provider-failure/provider-failure';

export const GITHUB_API = Symbol('GITHUB_API');

export interface GithubRequest {
  /** ETag del snapshot guardado: va como `If-None-Match` (un 304 autorizado no gasta cuota). */
  readonly etag?: string | null;
  /** Secreto del trabajo. Va SIEMPRE como `Authorization: Bearer`, también en la condicional. */
  readonly token: string;
  /** Señal del trabajo; el adaptador le suma su propio timeout por petición. */
  readonly signal: AbortSignal;
}

export interface GithubResponse {
  readonly status: number;
  /** Cabeceras con el nombre en minúsculas. */
  readonly headers: Readonly<Record<string, string | undefined>>;
  /** JSON ya interpretado, o `undefined` si no había cuerpo (p. ej. un 304). */
  readonly body: unknown;
}

/**
 * Puerto de la API REST de GitHub (change `add-github-code-evidence`, D2). Solo `GET` de rutas
 * relativas (`/repos/{owner}/{repo}`): la URL base es fija en el adaptador. Un fallo de red,
 * timeout, cuerpo demasiado grande o JSON inválido vuelve como `ProviderFailure`; cualquier
 * respuesta HTTP (también 4xx y 5xx) vuelve como `GithubResponse` para clasificarla.
 */
export interface GithubApi {
  get(path: string, request: GithubRequest): Promise<Result<GithubResponse, ProviderFailure>>;
}
