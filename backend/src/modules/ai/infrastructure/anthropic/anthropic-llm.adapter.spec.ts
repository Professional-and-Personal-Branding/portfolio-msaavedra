import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { z } from 'zod';
import { LlmRequest } from '../../application/ports/llm.port';
import { createAnthropicClient } from './anthropic-client.factory';
import { AnthropicLlmAdapter } from './anthropic-llm.adapter';

/**
 * El adaptador real contra un servidor HTTP falso en 127.0.0.1 (puerto 0). La URL base solo se
 * inyecta acá: en la app es fija. Ninguna prueba sale a internet ni usa una clave real.
 */
interface Seen {
  path: string;
  headers: IncomingMessage['headers'];
  body: Record<string, unknown>;
}

const TEST_KEY = 'test-key-no-es-real-0123456789';
const schema = z.object({ estado: z.enum(['ok']) });

function messageBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-5-5',
    content: [{ type: 'text', text: '{"estado":"ok"}' }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    stop_details: null,
    usage: { input_tokens: 200, output_tokens: 50 },
    ...overrides,
  };
}

type Responder = (seen: Seen, res: ServerResponse) => void;

class FakeAnthropic {
  readonly seen: Seen[] = [];
  private server!: Server;
  responder: Responder = (_seen, res) => this.json(res, 200, messageBody());
  baseURL = '';

  json(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
    res.writeHead(status, {
      'content-type': 'application/json',
      'request-id': 'req_fake_1',
      ...headers,
    });
    res.end(JSON.stringify(body));
  }

  async start(): Promise<void> {
    this.server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const seen: Seen = {
          path: req.url ?? '',
          headers: req.headers,
          body: JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}') as Record<
            string,
            unknown
          >,
        };
        this.seen.push(seen);
        if (seen.path.startsWith('/v1/messages/count_tokens')) {
          this.json(res, 200, { input_tokens: 123 });
          return;
        }
        this.responder(seen, res);
      });
    });
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    this.baseURL = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  async stop(): Promise<void> {
    this.server.closeAllConnections();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  messages(): Seen[] {
    return this.seen.filter((s) => s.path === '/v1/messages' || s.path.startsWith('/v1/messages?'));
  }
}

function request(
  overrides: Partial<LlmRequest<{ estado: 'ok' }>> = {},
): LlmRequest<{ estado: 'ok' }> {
  return {
    task: 'ai.smoke',
    cacheKey: 'k',
    model: 'claude-haiku-5-5',
    effort: 'low',
    thinking: 'off',
    maxTokens: 256,
    system: 'sistema',
    cacheSystemPrompt: false,
    user: '<datos>{}</datos>',
    schema,
    ...overrides,
  };
}

describe('AnthropicLlmAdapter (contra un servidor HTTP falso)', () => {
  const api = new FakeAnthropic();
  let adapter: AnthropicLlmAdapter;
  const signal = new AbortController().signal;

  const build = (timeoutMs = 5000) =>
    new AnthropicLlmAdapter(
      createAnthropicClient({ apiKey: TEST_KEY, timeoutMs, baseURL: api.baseURL }),
      { timeoutMs, knownSecrets: [TEST_KEY] },
    );

  beforeAll(async () => {
    await api.start();
  });
  afterAll(async () => {
    await api.stop();
  });
  beforeEach(() => {
    api.seen.length = 0;
    api.responder = (_seen, res) => api.json(res, 200, messageBody());
    adapter = build();
  });

  it('éxito: devuelve la salida validada, el uso y el id de la petición', async () => {
    const result = await adapter.complete(request(), signal);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.output).toEqual({ estado: 'ok' });
    expect(result.value.usage).toEqual({
      inputTokens: 200,
      outputTokens: 50,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
    expect(result.value.requestId).toBe('req_fake_1');
    expect(result.value.stopReason).toBe('end_turn');
  });

  it('la clave llega al servidor como credencial (el SDK 1.9 usa Authorization: Bearer) y la versión de API es la vigente', async () => {
    await adapter.complete(request(), signal);
    const [seen] = api.messages();
    expect(seen.headers.authorization).toBe(`Bearer ${TEST_KEY}`);
    expect(seen.headers['anthropic-version']).toBe('2026-10-21');
  });

  it('el cuerpo no lleva temperature, top_p, top_k ni tool_choice y termina en un mensaje del usuario', async () => {
    await adapter.complete(request(), signal);
    const [seen] = api.messages();
    for (const forbidden of ['temperature', 'top_p', 'top_k', 'tool_choice', 'tools']) {
      expect(seen.body).not.toHaveProperty(forbidden);
    }
    const messages = seen.body.messages as Array<{ role: string }>;
    expect(messages.at(-1)?.role).toBe('user');
    expect(seen.body.max_tokens).toBe(256);
    expect(seen.body.output_config).toMatchObject({
      effort: 'low',
      format: { type: 'json_schema' },
    });
  });

  it('thinking apagado: Haiku manda disabled y Sonnet manda between_tools sin otros campos', async () => {
    await adapter.complete(request({ model: 'claude-haiku-5-5' }), signal);
    await adapter.complete(request({ model: 'claude-sonnet-5-5', effort: 'high' }), signal);
    const [haiku, sonnet] = api.messages();
    expect(haiku.body.thinking).toEqual({ type: 'disabled' });
    expect(sonnet.body.thinking).toEqual({ type: 'between_tools' });
    expect((sonnet.body.output_config as { effort: string }).effort).toBe('high');
  });

  it('thinking adaptive manda adaptive', async () => {
    await adapter.complete(request({ thinking: 'adaptive' }), signal);
    expect(api.messages()[0].body.thinking).toEqual({ type: 'adaptive' });
  });

  it('cacheSystemPrompt manda el system con cache_control efímero', async () => {
    await adapter.complete(request({ cacheSystemPrompt: true }), signal);
    expect(api.messages()[0].body.system).toEqual([
      { type: 'text', text: 'sistema', cache_control: { type: 'ephemeral' } },
    ]);
  });

  it('countTokens devuelve el conteo y manda la misma configuración', async () => {
    const result = await adapter.countInputTokens(request(), signal);
    expect(result).toEqual({ ok: true, value: 123 });
    const count = api.seen.find((s) => s.path.startsWith('/v1/messages/count_tokens'));
    expect(count?.body).not.toHaveProperty('tool_choice');
    expect(count?.body.model).toBe('claude-haiku-5-5');
  });

  it('un 529 se hace una sola vez (sin reintentos del SDK) y es Transient', async () => {
    api.responder = (_s, res) =>
      api.json(res, 529, { type: 'error', error: { type: 'overloaded_error', message: 'x' } });
    const result = await adapter.complete(request(), signal);
    expect(api.messages()).toHaveLength(1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('Transient');
  });

  it('un 429 del tope del tier es BudgetExhausted con reinicio el día 1 del mes siguiente', async () => {
    api.responder = (_s, res) =>
      api.json(res, 429, {
        type: 'error',
        error: {
          type: 'rate_limit_error',
          message: 'You have reached your specified API usage limits.',
          details: { error_code: 'enforced_spend_limit_reached' },
        },
      });
    const result = await adapter.complete(request(), signal);
    expect(api.messages()).toHaveLength(1);
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'BudgetExhausted') {
      expect(result.error.resetAt?.getUTCDate()).toBe(1);
      expect(result.error.resetAt?.getUTCHours()).toBe(0);
    } else {
      throw new Error('se esperaba BudgetExhausted');
    }
  });

  it('un 400 del spend limit de la Console es BudgetExhausted sin fecha', async () => {
    api.responder = (_s, res) =>
      api.json(res, 400, {
        type: 'error',
        error: {
          type: 'invalid_request_error',
          message: 'You have reached your specified workspace API usage limits.',
        },
      });
    const result = await adapter.complete(request(), signal);
    expect(!result.ok && result.error.kind).toBe('BudgetExhausted');
    if (!result.ok && result.error.kind === 'BudgetExhausted') {
      expect(result.error.resetAt).toBeUndefined();
    }
  });

  it('un 400 por un parámetro inválido es Permanent', async () => {
    api.responder = (_s, res) =>
      api.json(res, 400, {
        type: 'error',
        error: {
          type: 'invalid_request_error',
          message: 'thinking.type.disabled is not supported',
        },
      });
    const result = await adapter.complete(request(), signal);
    expect(!result.ok && result.error.kind).toBe('Permanent');
  });

  it('un 401 es Permanent con «Anthropic rechazó la clave» y no filtra la clave', async () => {
    api.responder = (_s, res) =>
      api.json(res, 401, {
        type: 'error',
        error: { type: 'authentication_error', message: `invalid x-api-key ${TEST_KEY}` },
      });
    const result = await adapter.complete(request(), signal);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('Permanent');
      expect(JSON.stringify(result.error)).not.toContain(TEST_KEY);
      if ('message' in result.error)
        expect(result.error.message).toBe('Anthropic rechazó la clave');
    }
  });

  it('stop_reason refusal → Refused con la categoría y el uso', async () => {
    api.responder = (_s, res) =>
      api.json(
        res,
        200,
        messageBody({
          content: [],
          stop_reason: 'refusal',
          stop_details: { type: 'refusal', category: 'cyber', explanation: null },
        }),
      );
    const result = await adapter.complete(request(), signal);
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'Refused') {
      expect(result.error.category).toBe('cyber');
      expect(result.error.usage.inputTokens).toBe(200);
    } else {
      throw new Error('se esperaba Refused');
    }
  });

  it('stop_reason max_tokens → Truncated con el uso', async () => {
    api.responder = (_s, res) =>
      api.json(
        res,
        200,
        messageBody({
          content: [{ type: 'text', text: '{"estado":' }],
          stop_reason: 'max_tokens',
          usage: { input_tokens: 10, output_tokens: 256 },
        }),
      );
    const result = await adapter.complete(request(), signal);
    expect(!result.ok && result.error.kind).toBe('Truncated');
    if (!result.ok && result.error.kind === 'Truncated') {
      expect(result.error.usage.outputTokens).toBe(256);
    }
  });

  it('JSON inválido y JSON que no cumple el schema → InvalidOutput con el uso', async () => {
    api.responder = (_s, res) =>
      api.json(res, 200, messageBody({ content: [{ type: 'text', text: 'no es json' }] }));
    const notJson = await adapter.complete(request(), signal);
    expect(!notJson.ok && notJson.error.kind).toBe('InvalidOutput');

    api.responder = (_s, res) =>
      api.json(res, 200, messageBody({ content: [{ type: 'text', text: '{"estado":"no"}' }] }));
    const wrong = await adapter.complete(request(), signal);
    expect(!wrong.ok && wrong.error.kind).toBe('InvalidOutput');
    if (!wrong.ok && wrong.error.kind === 'InvalidOutput') {
      expect(wrong.error.usage.outputTokens).toBe(50);
      expect(wrong.error.issues[0]).toBe('invalid_value (profundidad 1)');
      expect(wrong.error.issues.join(' ')).not.toContain('estado');
    }
  });

  it('el uso con caché se informa por separado', async () => {
    api.responder = (_s, res) =>
      api.json(
        res,
        200,
        messageBody({
          usage: {
            input_tokens: 10,
            output_tokens: 5,
            cache_read_input_tokens: 400,
            cache_creation_input_tokens: 20,
          },
        }),
      );
    const result = await adapter.complete(request(), signal);
    expect(result.ok && result.value.usage).toEqual({
      inputTokens: 10,
      outputTokens: 5,
      cacheReadTokens: 400,
      cacheWriteTokens: 20,
    });
  });

  it('M1: un socket cortado después de enviar es Transient con billingUnknown (puede haberse facturado)', async () => {
    api.responder = (_s, res) => {
      res.socket?.destroy();
    };
    const result = await adapter.complete(request(), signal);
    expect(api.messages()).toHaveLength(1);
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'Transient') {
      expect(result.error.billingUnknown).toBe(true);
    } else {
      throw new Error('se esperaba Transient');
    }
  });

  it('M1: una respuesta HTTP 5xx NO es billingUnknown (con seguridad no se facturó)', async () => {
    api.responder = (_s, res) =>
      api.json(res, 500, { type: 'error', error: { type: 'api_error', message: 'x' } });
    const result = await adapter.complete(request(), signal);
    expect(!result.ok && result.error.kind).toBe('Transient');
    if (!result.ok) expect('billingUnknown' in result.error).toBe(false);
  });

  it('M1: un error desconocido del cliente también imputa la reserva', async () => {
    const broken = new AnthropicLlmAdapter(
      {
        messages: {
          create: () => {
            throw new TypeError('algo raro');
          },
        },
      } as never,
      { timeoutMs: 5000, knownSecrets: [TEST_KEY] },
    );
    const result = await broken.complete(request(), signal);
    expect(!result.ok && result.error.kind).toBe('Transient');
    if (!result.ok && result.error.kind === 'Transient') {
      expect(result.error.billingUnknown).toBe(true);
    }
  });

  it('timeout: Transient con billingUnknown y una sola petición', async () => {
    api.responder = () => {
      /* no responde nunca */
    };
    const result = await build(300).complete(request(), signal);
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'Transient') {
      expect(result.error.billingUnknown).toBe(true);
      expect(result.error.message).toContain('timeout');
    } else {
      throw new Error('se esperaba Transient');
    }
    expect(api.messages()).toHaveLength(1);
  });

  it('aborto del llamador: Transient con billingUnknown', async () => {
    api.responder = () => {
      /* no responde nunca */
    };
    const controller = new AbortController();
    const pending = adapter.complete(request(), controller.signal);
    setTimeout(() => controller.abort(), 100);
    const result = await pending;
    expect(!result.ok && result.error.kind).toBe('Transient');
    if (!result.ok && result.error.kind === 'Transient') {
      expect(result.error.billingUnknown).toBe(true);
    }
  });

  it('el conteo se reintenta (gratis): un 529 seguido de un 200 termina bien', async () => {
    let calls = 0;
    const countServer = createServer((_req, res) => {
      calls += 1;
      if (calls === 1) {
        res.writeHead(529, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'x' } }),
        );
      } else {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ input_tokens: 77 }));
      }
    });
    await new Promise<void>((resolve) => countServer.listen(0, '127.0.0.1', resolve));
    try {
      const baseURL = `http://127.0.0.1:${(countServer.address() as AddressInfo).port}`;
      const retrying = new AnthropicLlmAdapter(
        createAnthropicClient({ apiKey: TEST_KEY, timeoutMs: 5000, baseURL }),
        { timeoutMs: 5000, knownSecrets: [TEST_KEY] },
      );
      expect(await retrying.countInputTokens(request(), signal)).toEqual({ ok: true, value: 77 });
      expect(calls).toBe(2);
    } finally {
      countServer.closeAllConnections();
      await new Promise<void>((resolve) => countServer.close(() => resolve()));
    }
  });
});

describe('createAnthropicClient', () => {
  it('B5: el nivel de log es explícito y ANTHROPIC_LOG=debug del entorno no lo cambia', () => {
    const previous = process.env.ANTHROPIC_LOG;
    process.env.ANTHROPIC_LOG = 'debug';
    try {
      const client = createAnthropicClient({ apiKey: TEST_KEY, timeoutMs: 5000 });
      expect((client as unknown as { logLevel?: string }).logLevel).toBe('warn');
    } finally {
      if (previous === undefined) delete process.env.ANTHROPIC_LOG;
      else process.env.ANTHROPIC_LOG = previous;
    }
  });

  it('ignora ANTHROPIC_BASE_URL y ANTHROPIC_AUTH_TOKEN del entorno', () => {
    const previous = { ...process.env };
    process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:1';
    process.env.ANTHROPIC_AUTH_TOKEN = 'token-ambiental';
    try {
      const client = createAnthropicClient({ apiKey: TEST_KEY, timeoutMs: 5000 });
      expect(client.baseURL).toBe('https://api.anthropic.com');
      expect(client.maxRetries).toBe(0);
      expect(client.apiKey).toBe(TEST_KEY);
    } finally {
      process.env = previous;
    }
  });
});
