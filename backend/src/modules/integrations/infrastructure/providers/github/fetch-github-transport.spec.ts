import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import {
  FetchGithubTransport,
  GITHUB_API_BASE_URL,
  GITHUB_REQUEST_TIMEOUT_MS,
  MAX_GITHUB_BODY_BYTES,
} from './fetch-github-transport';

/**
 * Pruebas contra un servidor HTTP en 127.0.0.1 (puerto 0): jamás hay una petición a GitHub ni a
 * ningún tercero. La URL base solo se inyecta por constructor, aquí.
 */
const TOKEN = 'token-de-prueba-no-real';

interface Seen {
  url: string;
  headers: IncomingMessage['headers'];
}

type Handler = (req: IncomingMessage, res: ServerResponse, seen: Seen[]) => void;

let server: Server;
let baseUrl: string;
let seen: Seen[];
let handler: Handler;

beforeEach(async () => {
  seen = [];
  handler = (_req, res) => res.writeHead(200, { 'content-type': 'application/json' }).end('{}');
  server = createServer((req, res) => {
    seen.push({ url: req.url ?? '', headers: req.headers });
    handler(req, res, seen);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const signal = (): AbortSignal => new AbortController().signal;

describe('FetchGithubTransport', () => {
  it('la URL base por defecto es la constante de GitHub y el timeout es de 15 s', () => {
    expect(GITHUB_API_BASE_URL).toBe('https://api.github.com');
    expect(GITHUB_REQUEST_TIMEOUT_MS).toBe(15_000);
  });

  it('manda Authorization, Accept, versión de la API y User-Agent; sin ETag no hay If-None-Match', async () => {
    const transport = new FetchGithubTransport(baseUrl);
    const result = await transport.get('/repos/octo-org/reservas-api', {
      token: TOKEN,
      signal: signal(),
    });
    expect(result).toMatchObject({ ok: true, value: { status: 200, body: {} } });
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe('/repos/octo-org/reservas-api');
    expect(seen[0].headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(seen[0].headers.accept).toBe('application/vnd.github+json');
    expect(seen[0].headers['x-github-api-version']).toBe('2022-11-28');
    expect(seen[0].headers['user-agent']).toBe('portfolio-code-evidence');
    expect(seen[0].headers['if-none-match']).toBeUndefined();
  });

  it('la petición condicional lleva If-None-Match Y Authorization; un 304 vuelve sin cuerpo', async () => {
    handler = (_req, res) => res.writeHead(304, { etag: '"abc"' }).end();
    const transport = new FetchGithubTransport(baseUrl);
    const result = await transport.get('/repos/o/r', {
      etag: '"abc"',
      token: TOKEN,
      signal: signal(),
    });
    expect(result).toMatchObject({
      ok: true,
      value: { status: 304, headers: { etag: '"abc"' }, body: undefined },
    });
    expect(seen[0].headers['if-none-match']).toBe('"abc"');
    expect(seen[0].headers.authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('expone las cabeceras de cuota en minúsculas', async () => {
    handler = (_req, res) =>
      res
        .writeHead(200, { 'X-RateLimit-Remaining': '4999', 'X-RateLimit-Reset': '1795000000' })
        .end('{}');
    const result = await new FetchGithubTransport(baseUrl).get('/repos/o/r', {
      token: TOKEN,
      signal: signal(),
    });
    expect(result).toMatchObject({
      ok: true,
      value: { headers: { 'x-ratelimit-remaining': '4999', 'x-ratelimit-reset': '1795000000' } },
    });
  });

  describe('redirecciones (D5)', () => {
    it('sigue una 301 dentro de la API y repite Authorization en el salto', async () => {
      handler = (req, res) => {
        if (req.url === '/repos/o/viejo') {
          res.writeHead(301, { location: `${baseUrl}/repositories/123` }).end();
        } else {
          res.writeHead(200, { 'content-type': 'application/json' }).end('{"full_name":"o/nuevo"}');
        }
      };
      const result = await new FetchGithubTransport(baseUrl).get('/repos/o/viejo', {
        etag: '"v1"',
        token: TOKEN,
        signal: signal(),
      });
      expect(result).toMatchObject({
        ok: true,
        value: { status: 200, body: { full_name: 'o/nuevo' } },
      });
      expect(seen.map((s) => s.url)).toEqual(['/repos/o/viejo', '/repositories/123']);
      expect(seen.every((s) => s.headers.authorization === `Bearer ${TOKEN}`)).toBe(true);
      expect(seen[1].headers['if-none-match']).toBe('"v1"');
    });

    it('una ruta relativa en location también se sigue', async () => {
      handler = (req, res) => {
        if (req.url === '/a') res.writeHead(307, { location: '/b' }).end();
        else res.writeHead(200).end('{}');
      };
      const result = await new FetchGithubTransport(baseUrl).get('/a', {
        token: TOKEN,
        signal: signal(),
      });
      expect(result).toMatchObject({ ok: true, value: { status: 200 } });
      expect(seen.map((s) => s.url)).toEqual(['/a', '/b']);
    });

    it('una redirección a otro origen NO se pide y la 302 vuelve tal cual (el token no sale)', async () => {
      const otherOrigin = baseUrl.replace('127.0.0.1', 'localhost');
      handler = (_req, res) => res.writeHead(302, { location: `${otherOrigin}/x` }).end();
      const result = await new FetchGithubTransport(baseUrl).get('/repos/o/r', {
        token: TOKEN,
        signal: signal(),
      });
      expect(result).toMatchObject({
        ok: true,
        value: { status: 302, headers: { location: `${otherOrigin}/x` } },
      });
      expect(seen).toHaveLength(1);
    });

    it('un location con credenciales o de otro esquema tampoco se sigue', async () => {
      handler = (_req, res) => res.writeHead(302, { location: `http://octo@127.0.0.1:1/x` }).end();
      const result = await new FetchGithubTransport(baseUrl).get('/repos/o/r', {
        token: TOKEN,
        signal: signal(),
      });
      expect(result).toMatchObject({ ok: true, value: { status: 302 } });
      expect(seen).toHaveLength(1);
    });

    it('rechaza el tercer salto: tras dos redirecciones la 301 vuelve sin seguirla', async () => {
      handler = (req, res) => {
        const step = Number((req.url ?? '').replace('/p', '')) || 0;
        res.writeHead(301, { location: `${baseUrl}/p${step + 1}` }).end();
      };
      const result = await new FetchGithubTransport(baseUrl).get('/p0', {
        token: TOKEN,
        signal: signal(),
      });
      expect(result).toMatchObject({ ok: true, value: { status: 301 } });
      expect(seen.map((s) => s.url)).toEqual(['/p0', '/p1', '/p2']);
    });

    it('una redirección sin location vuelve tal cual', async () => {
      handler = (_req, res) => res.writeHead(302).end();
      const result = await new FetchGithubTransport(baseUrl).get('/x', {
        token: TOKEN,
        signal: signal(),
      });
      expect(result).toMatchObject({ ok: true, value: { status: 302 } });
      expect(seen).toHaveLength(1);
    });
  });

  describe('cuerpo', () => {
    it('un cuerpo de más de 512 KiB se corta sin JSON.parse y es Permanent', async () => {
      const big = JSON.stringify({ x: 'y'.repeat(MAX_GITHUB_BODY_BYTES + 10) });
      handler = (_req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(big);
      };
      const parse = jest.spyOn(JSON, 'parse');
      const result = await new FetchGithubTransport(baseUrl).get('/repos/o/r', {
        token: TOKEN,
        signal: signal(),
      });
      expect(result).toMatchObject({ ok: false, error: { kind: 'Permanent' } });
      expect(parse).not.toHaveBeenCalled();
      parse.mockRestore();
    });

    it('un cuerpo grande sin content-length (chunked) también se corta', async () => {
      handler = (_req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.write('{"x":"');
        const chunk = 'z'.repeat(64 * 1024);
        for (let i = 0; i < 10; i++) res.write(chunk);
        res.end('"}');
      };
      const result = await new FetchGithubTransport(baseUrl).get('/repos/o/r', {
        token: TOKEN,
        signal: signal(),
      });
      expect(result).toMatchObject({ ok: false, error: { kind: 'Permanent' } });
    });

    it('un 200 que no es JSON es Permanent', async () => {
      handler = (_req, res) => res.writeHead(200).end('<html>no soy json</html>');
      const result = await new FetchGithubTransport(baseUrl).get('/repos/o/r', {
        token: TOKEN,
        signal: signal(),
      });
      expect(result).toMatchObject({ ok: false, error: { kind: 'Permanent' } });
    });

    it('un error con cuerpo JSON expone el mensaje; con cuerpo no JSON queda sin cuerpo', async () => {
      handler = (req, res) => {
        if (req.url === '/json') res.writeHead(403).end('{"message":"secondary rate limit"}');
        else res.writeHead(404).end('no soy json');
      };
      const transport = new FetchGithubTransport(baseUrl);
      expect(await transport.get('/json', { token: TOKEN, signal: signal() })).toMatchObject({
        ok: true,
        value: { status: 403, body: { message: 'secondary rate limit' } },
      });
      expect(await transport.get('/texto', { token: TOKEN, signal: signal() })).toMatchObject({
        ok: true,
        value: { status: 404, body: undefined },
      });
    });
  });

  describe('abortos y red', () => {
    it('la señal del trabajo aborta la petición en curso como Transient', async () => {
      handler = () => undefined; // nunca responde
      const controller = new AbortController();
      const pending = new FetchGithubTransport(baseUrl).get('/repos/o/r', {
        token: TOKEN,
        signal: controller.signal,
      });
      setTimeout(() => controller.abort(), 50);
      const result = await pending;
      expect(result).toMatchObject({ ok: false, error: { kind: 'Transient' } });
      expect(JSON.stringify(result)).toContain('abortada');
    });

    it('una señal ya abortada falla sin esperar', async () => {
      const controller = new AbortController();
      controller.abort();
      const result = await new FetchGithubTransport(baseUrl).get('/repos/o/r', {
        token: TOKEN,
        signal: controller.signal,
      });
      expect(result).toMatchObject({ ok: false, error: { kind: 'Transient' } });
    });

    it('el timeout propio corta una petición colgada como Transient', async () => {
      handler = () => undefined;
      const result = await new FetchGithubTransport(baseUrl, 100).get('/repos/o/r', {
        token: TOKEN,
        signal: signal(),
      });
      expect(result).toMatchObject({ ok: false, error: { kind: 'Transient' } });
      expect(JSON.stringify(result)).toContain('timeout');
    });

    it('un servidor caído es Transient y el mensaje no incluye el token', async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      const result = await new FetchGithubTransport(baseUrl).get('/repos/o/r', {
        token: TOKEN,
        signal: signal(),
      });
      expect(result).toMatchObject({ ok: false, error: { kind: 'Transient' } });
      expect(JSON.stringify(result)).not.toContain(TOKEN);
      // afterEach vuelve a cerrar: se reabre un servidor vacío para que no falle.
      server = createServer();
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    });
  });
});
