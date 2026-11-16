import { fail, ok, Result } from '../../../../../shared/domain/result';
import {
  GithubApi,
  GithubRequest,
  GithubResponse,
} from '../../../application/github/github-api.port';
import { permanent, ProviderFailure, transient } from '../../../domain/provider-failure';

/** URL base FIJA (D3): no hay variable de entorno, así el token no puede redirigirse a otro host. */
export const GITHUB_API_BASE_URL = 'https://api.github.com';
export const GITHUB_API_VERSION = '2022-11-28';
export const GITHUB_USER_AGENT = 'portfolio-code-evidence';
/** Timeout propio de cada petición, además de la señal del trabajo (D3). */
export const GITHUB_REQUEST_TIMEOUT_MS = 15_000;
/** Un cuerpo más grande se corta al leerlo, sin `JSON.parse` (D3). */
export const MAX_GITHUB_BODY_BYTES = 512 * 1024;
/** Saltos de redirección que se siguen a mano (D5). */
export const MAX_GITHUB_REDIRECTS = 2;

const FOLLOWED_REDIRECTS = new Set([301, 302, 307]);

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400 && status !== 304;
}

/**
 * Adaptador real de `GithubApi` sobre `fetch` de Node (change `add-github-code-evidence`, D3, D5).
 * Solo `GET`. Cada petición, también la condicional y la que sigue una redirección, lleva
 * `Authorization: Bearer`. Las redirecciones se siguen a mano y solo dentro de la API de GitHub:
 * un `location` de otro origen NO se pide (el token jamás sale de `api.github.com`) y la respuesta
 * 3xx vuelve tal cual para que se clasifique. La URL base solo se inyecta por constructor en los
 * tests, contra un servidor en `127.0.0.1`.
 */
export class FetchGithubTransport implements GithubApi {
  private readonly base: URL;

  constructor(
    baseUrl: string = GITHUB_API_BASE_URL,
    private readonly timeoutMs: number = GITHUB_REQUEST_TIMEOUT_MS,
  ) {
    this.base = new URL(baseUrl);
  }

  async get(
    path: string,
    request: GithubRequest,
  ): Promise<Result<GithubResponse, ProviderFailure>> {
    let url = new URL(path, this.base);
    for (let hop = 0; ; hop++) {
      const answer = await this.fetchOnce(url, request);
      if (!answer.ok) return answer;
      const response = answer.value;
      const next = this.nextHop(url, response);
      if (next === null || hop >= MAX_GITHUB_REDIRECTS) return answer;
      url = next;
    }
  }

  /** Destino de una redirección a seguir, o `null` si no corresponde (otro origen, sin destino…). */
  private nextHop(current: URL, response: GithubResponse): URL | null {
    if (!FOLLOWED_REDIRECTS.has(response.status)) return null;
    const location = response.headers.location;
    if (!location) return null;
    let target: URL;
    try {
      target = new URL(location, current);
    } catch {
      return null;
    }
    const sameOrigin = target.origin === this.base.origin && target.username === '';
    return sameOrigin ? target : null;
  }

  private async fetchOnce(
    url: URL,
    request: GithubRequest,
  ): Promise<Result<GithubResponse, ProviderFailure>> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${request.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
      'User-Agent': GITHUB_USER_AGENT,
    };
    if (request.etag) headers['If-None-Match'] = request.etag;

    const timeout = AbortSignal.timeout(this.timeoutMs);
    const signal = AbortSignal.any([request.signal, timeout]);
    try {
      const response = await fetch(url, { method: 'GET', headers, redirect: 'manual', signal });
      const responseHeaders = toHeaderRecord(response.headers);
      // Una redirección o un 304 no traen cuerpo que importe: se descarta sin leerlo.
      if (isRedirect(response.status) || response.status === 304) {
        await response.body?.cancel();
        return ok({ status: response.status, headers: responseHeaders, body: undefined });
      }
      const body = await readLimitedBody(response);
      if (!body.ok) return fail(body.error);
      return this.interpret(response.status, responseHeaders, body.value);
    } catch (error) {
      return fail(failureOf(error, request.signal, timeout, this.timeoutMs));
    }
  }

  private interpret(
    status: number,
    headers: Record<string, string>,
    text: string,
  ): Result<GithubResponse, ProviderFailure> {
    if (text.trim() === '') return ok({ status, headers, body: undefined });
    try {
      return ok({ status, headers, body: JSON.parse(text) as unknown });
    } catch {
      // Un 200 que no es JSON rompe el contrato; en un error el cuerpo solo era informativo.
      return status === 200
        ? fail(permanent('la respuesta de GitHub no es un JSON válido'))
        : ok({ status, headers, body: undefined });
    }
  }
}

function toHeaderRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, name) => {
    record[name.toLowerCase()] = value;
  });
  return record;
}

/** Lee el cuerpo como texto cortando al pasar el tope: no se acumula ni se parsea de más. */
async function readLimitedBody(response: Response): Promise<Result<string, ProviderFailure>> {
  const tooBig = fail(permanent('la respuesta de GitHub supera el tamaño máximo permitido'));
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_GITHUB_BODY_BYTES) {
    await response.body?.cancel();
    return tooBig;
  }
  const reader = response.body?.getReader();
  if (!reader) return ok('');
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const chunk: { done: boolean; value?: Uint8Array } = await reader.read();
    if (chunk.done || chunk.value === undefined) break;
    const value = chunk.value;
    total += value.byteLength;
    if (total > MAX_GITHUB_BODY_BYTES) {
      await reader.cancel();
      return tooBig;
    }
    chunks.push(value);
  }
  return ok(Buffer.concat(chunks).toString('utf-8'));
}

/** Aborto del trabajo, timeout propio o red caída: todos `Transient`, sin mensajes del runtime. */
function failureOf(
  error: unknown,
  jobSignal: AbortSignal,
  timeout: AbortSignal,
  timeoutMs: number,
): ProviderFailure {
  if (jobSignal.aborted) return transient('petición a GitHub abortada');
  if (timeout.aborted || (error instanceof Error && error.name === 'TimeoutError')) {
    return transient(`timeout de ${Math.round(timeoutMs / 1000)} s al consultar GitHub`);
  }
  return transient('error de red al consultar GitHub');
}
