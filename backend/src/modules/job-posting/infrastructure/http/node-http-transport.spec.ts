import * as http from 'node:http';
import { AddressInfo, LookupFunction } from 'node:net';
import * as zlib from 'node:zlib';
import { DefaultSafeHttpClient } from './default-safe-http-client';
import { TransportError, TransportRequest } from './http-transport';
import { NodeHttpTransport } from './node-http-transport';
import { SystemDnsResolver } from './system-dns-resolver';

/** `acme.test` → `127.0.0.1`: el transporte no aplica política; la política es de `SafeHttpClient`. */
const testLookup: LookupFunction = (_hostname, options, callback) => {
  if (options.all) {
    (callback as (e: null, a: Array<{ address: string; family: number }>) => void)(null, [
      { address: '127.0.0.1', family: 4 },
    ]);
  } else {
    callback(null, '127.0.0.1', 4);
  }
};

describe('NodeHttpTransport (D9) contra un servidor local', () => {
  const connections: number[] = [];
  let received: http.IncomingMessage[] = [];
  let handler: (req: http.IncomingMessage, res: http.ServerResponse) => void;
  let server: http.Server;
  let port: number;
  let transport: NodeHttpTransport;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      received.push(req);
      handler(req, res);
    });
    server.on('connection', () => connections.push(1));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
    transport = new NodeHttpTransport({ lookup: testLookup, socketTimeoutMs: 300 });
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    received = [];
    connections.length = 0;
  });

  const request = (overrides: Partial<TransportRequest> = {}): TransportRequest => ({
    url: new URL(`http://acme.test:${port}/job/1`),
    address: null,
    accept: 'text/html',
    maxBytes: 1024,
    signal: AbortSignal.timeout(3000),
    shouldReadBody: (status) => status >= 200 && status < 300,
    ...overrides,
  });

  it('lee un cuerpo corto y devuelve estado, tipo y Location', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<p>hola</p>');
    };
    const response = await transport.get(request());
    expect(response).toEqual({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      location: null,
      body: '<p>hola</p>',
    });
  });

  it('no sigue redirects: devuelve el 302 con su Location y sin cuerpo', async () => {
    handler = (_req, res) => {
      res.writeHead(302, { Location: 'https://otra.acme-ejemplo.com/x' });
      res.end();
    };
    const response = await transport.get(request());
    expect(response.status).toBe(302);
    expect(response.location).toBe('https://otra.acme-ejemplo.com/x');
    expect(response.body).toBeNull();
    expect(received).toHaveLength(1);
  });

  it('con Content-Length mayor al tope corta sin leer el cuerpo', async () => {
    let wrote = 0;
    handler = (_req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Content-Length': String(10 * 1024 * 1024),
      });
      res.write('x'.repeat(100));
      wrote += 100;
      // No termina: el cliente debe cortar por el encabezado.
    };
    await expect(transport.get(request())).rejects.toMatchObject({ kind: 'too-large' });
    expect(wrote).toBe(100);
  });

  it('sin Content-Length corta al pasar el tope', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' }); // chunked
      res.write('a'.repeat(600));
      res.write('b'.repeat(600));
      res.end('c'.repeat(600));
    };
    await expect(transport.get(request())).rejects.toMatchObject({ kind: 'too-large' });
  });

  it('un gzip de 100 KB que se expande a 3 MiB corta al pasar el tope', async () => {
    const inflated = Buffer.alloc(3 * 1024 * 1024, 'a');
    const compressed = zlib.gzipSync(inflated);
    expect(compressed.length).toBeLessThan(100 * 1024);
    handler = (_req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Content-Encoding': 'gzip',
        'Content-Length': String(compressed.length),
      });
      res.end(compressed);
    };
    await expect(transport.get(request({ maxBytes: 2 * 1024 * 1024 }))).rejects.toMatchObject({
      kind: 'too-large',
    });
  });

  it('un gzip chico se descomprime', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Encoding': 'gzip' });
      res.end(zlib.gzipSync('<p>comprimido</p>'));
    };
    expect((await transport.get(request())).body).toBe('<p>comprimido</p>');
  });

  it('una codificación que no pidió (br) es un fallo de red', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Encoding': 'br' });
      res.end('x');
    };
    await expect(transport.get(request())).rejects.toMatchObject({ kind: 'network' });
  });

  it('un servidor que no termina de responder vence por el plazo total', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      // Gotea bytes: el socket no queda inactivo, el que corta es el plazo total.
      const timer = setInterval(() => res.write('.'), 40);
      res.on('close', () => clearInterval(timer));
    };
    const started = Date.now();
    await expect(
      transport.get(request({ signal: AbortSignal.timeout(400), maxBytes: 1024 * 1024 })),
    ).rejects.toMatchObject({ kind: 'timeout' });
    expect(Date.now() - started).toBeLessThan(2500);
  });

  it('un servidor que no responde nada vence por el timeout de socket', async () => {
    handler = () => undefined;
    await expect(transport.get(request())).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('un plazo ya vencido ni abre el socket', async () => {
    handler = (_req, res) => res.end('x');
    const aborted = AbortSignal.abort();
    await expect(transport.get(request({ signal: aborted }))).rejects.toBeInstanceOf(
      TransportError,
    );
    expect(connections).toHaveLength(0);
  });

  it('la petición es GET y no lleva Cookie, Authorization ni cabeceras ajenas', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('ok');
    };
    await transport.get(request());
    const [req] = received;
    expect(req.method).toBe('GET');
    expect(req.headers.cookie).toBeUndefined();
    expect(req.headers.authorization).toBeUndefined();
    expect(Object.keys(req.headers).sort()).toEqual(
      ['accept', 'accept-encoding', 'accept-language', 'connection', 'host', 'user-agent'].sort(),
    );
    expect(req.headers['user-agent']).toBe('PortfolioJobIntake/1.0');
    expect(req.headers['accept-encoding']).toBe('gzip, deflate');
    expect(req.headers.host).toBe(`acme.test:${port}`);
  });

  it('un Set-Cookie del servidor no se lee ni se reenvía', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html', 'Set-Cookie': 'sid=abc' });
      res.end('ok');
    };
    const response = await transport.get(request());
    expect(JSON.stringify(response)).not.toContain('sid=abc');
    await transport.get(request());
    expect(received[1].headers.cookie).toBeUndefined();
  });

  it('con una IP fijada conecta a ella y no usa el lookup propio', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('fijada');
    };
    const noLookup = new NodeHttpTransport({
      lookup: (_h, _o, cb) => (cb as (e: Error) => void)(new Error('no debería resolver')),
    });
    const response = await noLookup.get(request({ address: '127.0.0.1' }));
    expect(response.body).toBe('fijada');
  });

  it('shouldReadBody false corta tras las cabeceras', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/pdf' });
      res.end('%PDF');
    };
    const response = await transport.get(request({ shouldReadBody: () => false }));
    expect(response.body).toBeNull();
    expect(response.status).toBe(200);
  });

  it('un puerto cerrado es un fallo de red, sin detalles', async () => {
    const closed = await new Promise<number>((resolve) => {
      const probe = http.createServer().listen(0, '127.0.0.1', () => {
        const p = (probe.address() as AddressInfo).port;
        probe.close(() => resolve(p));
      });
    });
    await expect(
      transport.get(request({ url: new URL(`http://acme.test:${closed}/`) })),
    ).rejects.toMatchObject({ kind: 'network', message: 'no se pudo conectar' });
  });
});

describe('guarda real: SafeHttpClient + NodeHttpTransport', () => {
  it('un resolvedor que devuelve 127.0.0.1 rechaza y el servidor local registra 0 conexiones', async () => {
    let connectionCount = 0;
    let requestCount = 0;
    const server = http.createServer((_req, res) => {
      requestCount += 1;
      res.end('x');
    });
    server.on('connection', () => (connectionCount += 1));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

    try {
      const client = new DefaultSafeHttpClient(new NodeHttpTransport({ lookup: testLookup }), {
        resolve: () => Promise.resolve([{ address: '127.0.0.1', family: 4 }]),
      });
      // https al puerto 443 para pasar D7; el resolvedor devuelve loopback: debe cortar antes de conectar.
      const result = await client.get(new URL('https://vacantes.acme-ejemplo.com/job/1'), {
        accept: 'html',
        maxBytes: 1024,
        signal: AbortSignal.timeout(3000),
      });
      expect(!result.ok && result.error.reason).toBe('blocked-address');
      expect(connectionCount).toBe(0);
      expect(requestCount).toBe(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('con el resolvedor del sistema, `localhost` ni siquiera llega a resolverse (política D7)', async () => {
    const resolver = new SystemDnsResolver();
    const spy = jest.spyOn(resolver, 'resolve');
    const client = new DefaultSafeHttpClient(new NodeHttpTransport(), resolver);
    const result = await client.get(new URL('https://localhost/'), {
      accept: 'html',
      maxBytes: 1024,
      signal: AbortSignal.timeout(3000),
    });
    expect(result.ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});
