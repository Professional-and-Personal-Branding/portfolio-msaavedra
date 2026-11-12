import { ImportFailure } from '../../domain/errors/import-failure';
import { DefaultSafeHttpClient, MAX_REDIRECTS } from './default-safe-http-client';
import {
  DnsResolver,
  HttpTransport,
  ResolvedAddress,
  TransportError,
  TransportRequest,
  TransportResponse,
} from './http-transport';

type Scripted = TransportResponse | TransportError;

/** Transporte falso: responde por URL (en orden) y registra cada petición. */
class FakeTransport implements HttpTransport {
  readonly requests: TransportRequest[] = [];
  constructor(private readonly script: Record<string, Scripted[]>) {}

  get(request: TransportRequest): Promise<TransportResponse> {
    this.requests.push(request);
    const queue = this.script[request.url.href];
    const next = queue?.shift();
    if (!next) return Promise.reject(new Error(`sin respuesta para ${request.url.href}`));
    if (next instanceof TransportError) return Promise.reject(next);
    // Imita al transporte real: no entrega el cuerpo si no se debe leer.
    const read = request.shouldReadBody(next.status, next.contentType);
    return Promise.resolve({ ...next, body: read ? next.body : null });
  }
}

class FakeResolver implements DnsResolver {
  readonly resolved: string[] = [];
  constructor(private readonly hosts: Record<string, ResolvedAddress[]>) {}

  resolve(hostname: string): Promise<ResolvedAddress[]> {
    this.resolved.push(hostname);
    const found = this.hosts[hostname];
    if (!found) return Promise.reject(new Error('ENOTFOUND'));
    return Promise.resolve(found);
  }
}

const PUBLIC: ResolvedAddress[] = [{ address: '93.184.216.34', family: 4 }];
const html = (body: string, extra: Partial<TransportResponse> = {}): TransportResponse => ({
  status: 200,
  contentType: 'text/html; charset=utf-8',
  location: null,
  body,
  ...extra,
});
const redirect = (location: string, status = 302): TransportResponse => ({
  status,
  contentType: null,
  location,
  body: null,
});

function setup(script: Record<string, Scripted[]>, hosts?: Record<string, ResolvedAddress[]>) {
  const transport = new FakeTransport(script);
  const resolver = new FakeResolver(
    hosts ?? {
      'careers.acme-ejemplo.com': PUBLIC,
      'otra.acme-ejemplo.com': PUBLIC,
      'api.acme-ejemplo.com': PUBLIC,
    },
  );
  const client = new DefaultSafeHttpClient(transport, resolver);
  const get = (url: string, accept: 'html' | 'json' = 'html', maxBytes = 1024) =>
    client.get(new URL(url), { accept, maxBytes, signal: AbortSignal.timeout(5000) });
  return { transport, resolver, get };
}

async function failureOf(
  promise: Promise<{ ok: boolean; error?: unknown }>,
): Promise<ImportFailure> {
  const result = await promise;
  expect(result.ok).toBe(false);
  return result.error as ImportFailure;
}

describe('DefaultSafeHttpClient (D7–D10)', () => {
  const URL_OK = 'https://careers.acme-ejemplo.com/job/1';

  it('devuelve el cuerpo de una respuesta válida y conecta a la IP validada', async () => {
    const { transport, get } = setup({ [URL_OK]: [html('<html>ok</html>')] });
    const result = await get(URL_OK);
    expect(result).toEqual({ ok: true, value: { url: new URL(URL_OK), body: '<html>ok</html>' } });
    expect(transport.requests[0].address).toBe('93.184.216.34');
  });

  describe('redirects', () => {
    it('resuelve una Location relativa contra la URL actual', async () => {
      const { transport, get } = setup({
        [URL_OK]: [redirect('/job/2')],
        'https://careers.acme-ejemplo.com/job/2': [html('final')],
      });
      const result = await get(URL_OK);
      expect(result.ok && result.value.url.href).toBe('https://careers.acme-ejemplo.com/job/2');
      expect(transport.requests).toHaveLength(2);
    });

    it('a un host que resuelve a 172.16.0.10: 422 sin pedir el destino', async () => {
      const { transport, get } = setup(
        { [URL_OK]: [redirect('https://interno.acme-ejemplo.com/')] },
        {
          'careers.acme-ejemplo.com': PUBLIC,
          'interno.acme-ejemplo.com': [{ address: '172.16.0.10', family: 4 }],
        },
      );
      const error = await failureOf(get(URL_OK));
      expect(error.reason).toBe('blocked-address');
      expect(transport.requests.map((r) => r.url.hostname)).toEqual(['careers.acme-ejemplo.com']);
    });

    it('a http: (rebaje de protocolo): 422 sin pedir el destino', async () => {
      const { transport, get } = setup({
        [URL_OK]: [redirect('http://careers.acme-ejemplo.com/x')],
      });
      const error = await failureOf(get(URL_OK));
      expect(error.reason).toBe('url-not-allowed');
      expect(error.message).toBe('Usá una URL que empiece con https://');
      expect(transport.requests).toHaveLength(1);
    });

    it('a un portal cerrado (lnkd.in): 422 de portal cerrado, sin DNS ni petición al destino', async () => {
      const { transport, resolver, get } = setup({ [URL_OK]: [redirect('https://lnkd.in/abc')] });
      const error = await failureOf(get(URL_OK));
      expect(error.reason).toBe('closed-portal');
      expect(error.message).toContain('«LinkedIn»');
      expect(transport.requests).toHaveLength(1);
      expect(resolver.resolved).not.toContain('lnkd.in');
    });

    it.each(['https://127.0.0.1/', 'https://[::1]/', 'https://2130706433/', 'https://intranet/'])(
      'a una IP literal o nombre local (%s): 422 sin pedir el destino',
      async (target) => {
        const { transport, get } = setup({ [URL_OK]: [redirect(target)] });
        const error = await failureOf(get(URL_OK));
        expect(error.reason).toBe('url-not-allowed');
        expect(transport.requests).toHaveLength(1);
      },
    );

    it('el cuarto redirect da 422 «redirige demasiadas veces»', async () => {
      const hops = Array.from(
        { length: MAX_REDIRECTS + 1 },
        (_, i) => `https://careers.acme-ejemplo.com/h${i}`,
      );
      const script: Record<string, Scripted[]> = { [URL_OK]: [redirect(hops[0])] };
      hops.forEach((hop, i) => {
        script[hop] = [redirect(hops[i + 1] ?? 'https://careers.acme-ejemplo.com/fin')];
      });
      const { transport, get } = setup(script);
      const error = await failureOf(get(URL_OK));
      expect(error.reason).toBe('too-many-redirects');
      expect(error.message).toBe(
        'La página redirige demasiadas veces. Pegá el texto de la vacante.',
      );
      // Pedida + tres redirects seguidos; el cuarto no se sigue.
      expect(transport.requests).toHaveLength(MAX_REDIRECTS + 1);
    });

    it('tres redirects todavía se siguen', async () => {
      const script: Record<string, Scripted[]> = {
        [URL_OK]: [redirect('https://careers.acme-ejemplo.com/a')],
        'https://careers.acme-ejemplo.com/a': [redirect('https://careers.acme-ejemplo.com/b')],
        'https://careers.acme-ejemplo.com/b': [redirect('https://careers.acme-ejemplo.com/c')],
        'https://careers.acme-ejemplo.com/c': [html('fin')],
      };
      const { get } = setup(script);
      expect((await get(URL_OK)).ok).toBe(true);
    });

    it('un redirect sin Location da 422', async () => {
      const { get } = setup({ [URL_OK]: [redirect('')] });
      expect((await failureOf(get(URL_OK))).reason).toBe('upstream-error');
    });
  });

  describe('direcciones', () => {
    it('un resolvedor que devuelve una pública y una privada: rechazo', async () => {
      const { transport, get } = setup(
        { [URL_OK]: [html('x')] },
        {
          'careers.acme-ejemplo.com': [
            { address: '93.184.216.34', family: 4 },
            { address: '192.168.1.10', family: 4 },
          ],
        },
      );
      const error = await failureOf(get(URL_OK));
      expect(error.reason).toBe('blocked-address');
      expect(transport.requests).toHaveLength(0);
    });

    it.each([
      ['10.0.0.5', 4],
      ['169.254.169.254', 4],
      ['127.0.0.1', 4],
      ['::ffff:169.254.169.254', 6],
      ['fd12:3456::1', 6],
      ['::1', 6],
    ] as Array<[string, 4 | 6]>)(
      'un nombre que resuelve a %s se rechaza sin conectar',
      async (address, family) => {
        const { transport, get } = setup(
          { [URL_OK]: [html('x')] },
          { 'careers.acme-ejemplo.com': [{ address, family }] },
        );
        const error = await failureOf(get(URL_OK));
        expect(error.reason).toBe('blocked-address');
        expect(transport.requests).toHaveLength(0);
      },
    );

    it('los errores no incluyen la IP ni el cuerpo remoto', async () => {
      const { get } = setup(
        { [URL_OK]: [html('x')] },
        { 'careers.acme-ejemplo.com': [{ address: '10.0.0.5', family: 4 }] },
      );
      const error = await failureOf(get(URL_OK));
      expect(error.message).toBe(
        'La URL apunta a una dirección que no está permitida. Pegá el texto de la vacante.',
      );
      expect(error.message).not.toContain('10.0.0.5');
    });

    it('si hay IPv4 e IPv6 públicas, conecta a la IPv4 ya validada', async () => {
      const { transport, get } = setup(
        { [URL_OK]: [html('x')] },
        {
          'careers.acme-ejemplo.com': [
            { address: '2606:4700::1111', family: 6 },
            { address: '93.184.216.34', family: 4 },
          ],
        },
      );
      await get(URL_OK);
      expect(transport.requests[0].address).toBe('93.184.216.34');
    });

    it('un nombre que no resuelve da un 422 genérico', async () => {
      const { get } = setup({}, {});
      const error = await failureOf(get(URL_OK));
      expect(error.reason).toBe('upstream-error');
      expect(error.message).toBe(
        'No pudimos conectar con esa página. Pegá el texto de la vacante.',
      );
    });

    it('un resolvedor sin respuesta cuando vence el plazo da «tardó demasiado»', async () => {
      const transport = new FakeTransport({});
      const hanging: DnsResolver = { resolve: () => new Promise(() => undefined) };
      const client = new DefaultSafeHttpClient(transport, hanging);
      const result = await client.get(new URL(URL_OK), {
        accept: 'html',
        maxBytes: 100,
        signal: AbortSignal.timeout(30),
      });
      expect(!result.ok && result.error.reason).toBe('timeout');
    });
  });

  describe('Content-Type, estados y errores del transporte', () => {
    it('application/pdf: 422 «no devuelve una página de vacante»', async () => {
      const { get } = setup({ [URL_OK]: [html('%PDF', { contentType: 'application/pdf' })] });
      const error = await failureOf(get(URL_OK));
      expect(error.reason).toBe('unexpected-content-type');
      expect(error.message).toBe(
        'La URL no devuelve una página de vacante. Pegá el texto de la vacante.',
      );
    });

    it('para un ATS se espera application/json (con charset)', async () => {
      const api = 'https://api.acme-ejemplo.com/v1/jobs/1';
      const ok = setup({
        [api]: [
          {
            status: 200,
            contentType: 'application/json; charset=utf-8',
            location: null,
            body: '{}',
          },
        ],
      });
      expect((await ok.get(api, 'json')).ok).toBe(true);
      const bad = setup({ [api]: [html('<html>')] });
      expect((await failureOf(bad.get(api, 'json'))).reason).toBe('unexpected-content-type');
    });

    it('acepta application/xhtml+xml para HTML', async () => {
      const { get } = setup({ [URL_OK]: [html('x', { contentType: 'application/xhtml+xml' })] });
      expect((await get(URL_OK)).ok).toBe(true);
    });

    it.each([404, 410])(
      '%s: «No encontramos esa vacante (puede estar cerrada)»',
      async (status) => {
        const { get } = setup({
          [URL_OK]: [{ status, contentType: 'text/html', location: null, body: 'x' }],
        });
        const error = await failureOf(get(URL_OK));
        expect(error.reason).toBe('not-found');
        expect(error.message).toBe(
          'No encontramos esa vacante (puede estar cerrada). Pegá el texto de la vacante.',
        );
      },
    );

    it.each([500, 503, 403, 401, 429])('%s: «La página respondió con un error»', async (status) => {
      const { get } = setup({
        [URL_OK]: [{ status, contentType: 'text/html', location: null, body: 'secreto-remoto' }],
      });
      const error = await failureOf(get(URL_OK));
      expect(error.reason).toBe('upstream-error');
      expect(error.message).toBe('La página respondió con un error. Pegá el texto de la vacante.');
      expect(error.message).not.toContain('secreto-remoto');
    });

    it('el transporte que corta por tamaño: «demasiado grande»', async () => {
      const { get } = setup({ [URL_OK]: [new TransportError('too-large', 'x')] });
      const error = await failureOf(get(URL_OK));
      expect(error.reason).toBe('too-large');
      expect(error.message).toBe('La página es demasiado grande. Pegá el texto de la vacante.');
    });

    it('el transporte que vence: «tardó demasiado en responder»', async () => {
      const { get } = setup({ [URL_OK]: [new TransportError('timeout', 'x')] });
      const error = await failureOf(get(URL_OK));
      expect(error.reason).toBe('timeout');
      expect(error.message).toBe(
        'La página tardó demasiado en responder. Pegá el texto de la vacante.',
      );
    });

    it('un fallo de red es un 422 genérico', async () => {
      const { get } = setup({ [URL_OK]: [new TransportError('network', 'ECONNREFUSED 10.0.0.5')] });
      const error = await failureOf(get(URL_OK));
      expect(error.message).toBe(
        'No pudimos conectar con esa página. Pegá el texto de la vacante.',
      );
      expect(error.message).not.toContain('10.0.0.5');
    });
  });

  describe('política previa a la red', () => {
    it.each([
      'http://careers.acme-ejemplo.com/x',
      'https://127.0.0.1/',
      'https://careers.acme-ejemplo.com:5432/',
    ])('una URL que no cumple D7 (%s) no resuelve ni pide nada', async (raw) => {
      const { transport, resolver, get } = setup({});
      const result = await get(raw);
      expect(result.ok).toBe(false);
      expect(transport.requests).toHaveLength(0);
      expect(resolver.resolved).toHaveLength(0);
    });

    it('un portal cerrado no resuelve ni pide nada', async () => {
      const { transport, resolver, get } = setup({});
      const error = await failureOf(get('https://ar.indeed.com/viewjob?jk=1'));
      expect(error.reason).toBe('closed-portal');
      expect(transport.requests).toHaveLength(0);
      expect(resolver.resolved).toHaveLength(0);
    });
  });
});
