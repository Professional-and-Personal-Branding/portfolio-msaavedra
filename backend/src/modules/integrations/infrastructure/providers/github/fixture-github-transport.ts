import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { fail, ok, Result } from '../../../../../shared/domain/result';
import {
  GithubApi,
  GithubRequest,
  GithubResponse,
} from '../../../application/github/github-api.port';
import {
  ProviderFailure,
  transient,
} from '../../../../../shared/domain/provider-failure/provider-failure';

/** Secreto de prueba que el transporte rechaza con 401 (simula un token vencido). */
export const FIXTURE_INVALID_TOKEN = 'fixture-invalid-token';

/** Qué vio el transporte de una petición. Sin el valor del token: solo si había y su esquema. */
export interface RecordedGithubRequest {
  readonly path: string;
  readonly hasAuthorization: boolean;
  readonly authorizationScheme: string | null;
  readonly conditional: boolean;
}

const HEALTHY_RATE_HEADERS: Readonly<Record<string, string>> = {
  'x-ratelimit-limit': '5000',
  'x-ratelimit-remaining': '4990',
};

/**
 * Transporte de fixtures (change `add-github-code-evidence`, D15): responde desde
 * `backend/test/fixtures/github/<owner>/<repo>/{repo,languages}.json` con un ETag estable por
 * contenido y 304 ante `If-None-Match`. Casos por nombre de repositorio (cualquier dueño):
 * `rate-limited`, `secondary-limit` y `forbidden` se arman acá; `moved` y `private-repo` salen de
 * sus archivos. Un repositorio sin carpeta es 404. El secreto `fixture-invalid-token` responde 401
 * a todo. Lo usan los e2e, `manual:capture` y el TC-52: el arranque lo prohíbe en producción.
 * Nunca devuelve ni registra el valor del token.
 */
export class FixtureGithubTransport implements GithubApi {
  readonly requests: RecordedGithubRequest[] = [];
  maxConcurrent = 0;
  private inFlight = 0;

  constructor(private readonly fixturesDir: string = defaultFixturesDir()) {}

  resetRecording(): void {
    this.requests.length = 0;
    this.maxConcurrent = 0;
  }

  async get(
    path_: string,
    request: GithubRequest,
  ): Promise<Result<GithubResponse, ProviderFailure>> {
    this.requests.push({
      path: path_,
      hasAuthorization: request.token !== '',
      authorizationScheme: request.token !== '' ? 'Bearer' : null,
      conditional: Boolean(request.etag),
    });
    this.inFlight += 1;
    this.maxConcurrent = Math.max(this.maxConcurrent, this.inFlight);
    try {
      // Cede el turno como lo haría una red real: así se mide si alguien pide en paralelo.
      await new Promise<void>((resolve) => setImmediate(resolve));
      if (request.signal.aborted) return fail(transient('petición a GitHub abortada'));
      return ok(this.respond(path_, request));
    } finally {
      this.inFlight -= 1;
    }
  }

  private respond(requestPath: string, request: GithubRequest): GithubResponse {
    if (request.token === FIXTURE_INVALID_TOKEN) {
      return json(401, { message: 'Bad credentials' });
    }
    const match = /^\/repos\/([^/]+)\/([^/]+)(\/languages)?$/.exec(requestPath);
    if (!match) return json(404, { message: 'Not Found' });
    const owner = match[1].toLowerCase();
    const repo = match[2].toLowerCase();
    const resource = match[3] ? 'languages' : 'repo';

    switch (repo) {
      case 'rate-limited':
        return json(
          403,
          { message: 'API rate limit exceeded' },
          {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
          },
        );
      case 'secondary-limit':
        return json(403, {
          message: 'You have exceeded a secondary rate limit. Please wait a few minutes.',
        });
      case 'forbidden':
        return json(403, { message: 'Resource not accessible by personal access token' });
    }

    const file = path.join(this.fixturesDir, owner, repo, `${resource}.json`);
    if (!existsSync(file)) return json(404, { message: 'Not Found' });
    const content = readFileSync(file, 'utf-8');
    const etag = `"fixture-${createHash('sha256').update(content).digest('hex').slice(0, 12)}"`;
    if (request.etag === etag) {
      return { status: 304, headers: { ...HEALTHY_RATE_HEADERS, etag }, body: undefined };
    }
    return {
      status: 200,
      headers: { ...HEALTHY_RATE_HEADERS, etag },
      body: JSON.parse(content) as unknown,
    };
  }
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): GithubResponse {
  return { status, headers: { ...HEALTHY_RATE_HEADERS, ...headers }, body };
}

/** `backend/test/fixtures/github`, tanto desde `src/` como desde `dist/` (ambos cuelgan de `backend/`). */
export function defaultFixturesDir(): string {
  return path.resolve(__dirname, '../../../../../../test/fixtures/github');
}
