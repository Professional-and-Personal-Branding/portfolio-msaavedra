import { z } from 'zod';
import { AI_FAKE_SCENARIOS, AiFakeScenario } from '../domain/fake-scenarios';
import { LlmRequest } from '../application/ports/llm.port';
import { aiSmokeTask } from '../application/tasks/ai-smoke.task';
import { AnyAiTask } from '../application/tasks/ai-task';
import { AppConfig } from '../../../config/configuration';
import { Cassette, CassetteLlmAdapter } from './cassette/cassette-llm.adapter';
import { Semaphore } from './concurrency/semaphore';
import { DisabledLlmAdapter } from './disabled/disabled-llm.adapter';
import { FakeLlmAdapter } from './fake/fake-llm.adapter';
import { collectKnownSecrets } from './known-secrets';

const schema = z.object({ estado: z.enum(['ok']) });
const request: LlmRequest<{ estado: 'ok' }> = {
  task: 'ai.smoke',
  cacheKey: 'k1',
  model: 'claude-haiku-5-5',
  effort: 'low',
  thinking: 'off',
  maxTokens: 256,
  system: 'sistema',
  cacheSystemPrompt: false,
  user: '<datos>{}</datos>',
  schema,
};
const signal = new AbortController().signal;
const tasks = [aiSmokeTask as unknown as AnyAiTask];
const fake = (scenario: AiFakeScenario, timeoutMs = 5000) =>
  new FakeLlmAdapter({ scenario, timeoutMs, tasks });

describe('FakeLlmAdapter', () => {
  it('ok: devuelve el ejemplo válido de la tarea con el uso fijo', async () => {
    const result = await fake('ok').complete(request, signal);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.output).toEqual({ estado: 'ok' });
      expect(result.value.usage.inputTokens).toBe(200);
    }
  });

  it('cada escenario está cubierto por este test', () => {
    expect([...AI_FAKE_SCENARIOS]).toHaveLength(8);
  });

  it('refusal, truncated e invalid-output llevan uso para imputar el costo', async () => {
    for (const [scenario, kind] of [
      ['refusal', 'Refused'],
      ['truncated', 'Truncated'],
      ['invalid-output', 'InvalidOutput'],
    ] as const) {
      const result = await fake(scenario).complete(request, signal);
      expect(!result.ok && result.error.kind).toBe(kind);
    }
  });

  it('transient pasa por el clasificador real: 529 → Transient', async () => {
    const result = await fake('transient').complete(request, signal);
    expect(!result.ok && result.error.kind).toBe('Transient');
  });

  it('spend-limit-tier → BudgetExhausted con reinicio el día 1 del mes siguiente', async () => {
    const result = await fake('spend-limit-tier').complete(request, signal);
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'BudgetExhausted') {
      expect(result.error.resetAt?.getUTCDate()).toBe(1);
    } else {
      throw new Error('se esperaba BudgetExhausted');
    }
  });

  it('spend-limit-console → BudgetExhausted sin fecha', async () => {
    const result = await fake('spend-limit-console').complete(request, signal);
    expect(!result.ok && result.error.kind).toBe('BudgetExhausted');
    if (!result.ok && result.error.kind === 'BudgetExhausted') {
      expect(result.error.resetAt).toBeUndefined();
    }
  });

  it('slow: espera el timeout y falla como Transient con billingUnknown', async () => {
    const started = Date.now();
    const result = await fake('slow', 200).complete(request, signal);
    expect(Date.now() - started).toBeGreaterThanOrEqual(190);
    expect(!result.ok && result.error.kind).toBe('Transient');
    if (!result.ok && result.error.kind === 'Transient') {
      expect(result.error.billingUnknown).toBe(true);
    }
  });

  it('slow: se corta apenas se aborta la señal', async () => {
    const controller = new AbortController();
    const pending = fake('slow', 5000).complete(request, controller.signal);
    setTimeout(() => controller.abort(), 50);
    const started = Date.now();
    const result = await pending;
    expect(Date.now() - started).toBeLessThan(1000);
    expect(!result.ok && result.error.kind).toBe('Transient');
  });

  it('una tarea sin ejemplo válido da InvalidOutput en vez de inventar datos', async () => {
    const result = await new FakeLlmAdapter({ scenario: 'ok', timeoutMs: 1, tasks: [] }).complete(
      request,
      signal,
    );
    expect(!result.ok && result.error.kind).toBe('InvalidOutput');
  });

  it('el conteo es estable', async () => {
    const a = await fake('ok').countInputTokens(request);
    const b = await fake('ok').countInputTokens(request);
    expect(a).toEqual(b);
  });
});

describe('DisabledLlmAdapter', () => {
  it('nunca sale a la red: falla con Permanent', async () => {
    const adapter = new DisabledLlmAdapter();
    expect((await adapter.complete()).ok).toBe(false);
    expect((await adapter.countInputTokens()).ok).toBe(false);
  });
});

describe('CassetteLlmAdapter', () => {
  const cassette: Cassette = {
    task: 'ai.smoke',
    promptVersion: 1,
    promptSha256: 'x',
    model: 'claude-haiku-5-5',
    cacheKey: 'k1',
    recordedAt: '2026-11-17T00:00:00Z',
    sdkVersion: '1.9.0',
    pricingVerifiedAt: '2026-11-17',
    response: {
      content: [{ type: 'text', text: '{"estado":"ok"}' }],
      stop_reason: 'end_turn',
      stop_details: null,
      usage: { input_tokens: 150, output_tokens: 20 },
      model: 'claude-haiku-5-5',
    },
  };

  it('reproduce la respuesta grabada por cacheKey', async () => {
    const adapter = new CassetteLlmAdapter([cassette]);
    expect(await adapter.countInputTokens(request)).toEqual({ ok: true, value: 150 });
    const result = await adapter.complete(request);
    expect(result.ok && result.value.output).toEqual({ estado: 'ok' });
  });

  it('un cassette de rechazo y uno de max_tokens se interpretan como fallos tipados', async () => {
    const refusal: Cassette = {
      ...cassette,
      cacheKey: 'r',
      response: {
        ...cassette.response,
        content: [],
        stop_reason: 'refusal',
        stop_details: { category: 'cyber' },
      },
    };
    const truncated: Cassette = {
      ...cassette,
      cacheKey: 't',
      response: { ...cassette.response, stop_reason: 'max_tokens' },
    };
    const adapter = new CassetteLlmAdapter([refusal, truncated]);
    const r = await adapter.complete({ ...request, cacheKey: 'r' });
    const t = await adapter.complete({ ...request, cacheKey: 't' });
    expect(!r.ok && r.error.kind).toBe('Refused');
    expect(!t.ok && t.error.kind).toBe('Truncated');
  });

  it('sin cassette falla (nunca va a la red)', async () => {
    const adapter = new CassetteLlmAdapter([]);
    const result = await adapter.complete(request);
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'Permanent') {
      expect(result.error.message).toContain('falta el cassette');
    }
    expect(adapter.has('k1')).toBe(false);
  });
});

describe('Semaphore', () => {
  it('con límite 2, el tercero espera y falla en menos de 2,5 s si nadie libera', async () => {
    const semaphore = new Semaphore(2);
    const a = await semaphore.acquire(100);
    const b = await semaphore.acquire(100);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    const started = Date.now();
    const third = await semaphore.acquire(300);
    expect(third).toBeNull();
    expect(Date.now() - started).toBeLessThan(2500);
  });

  it('un lugar liberado pasa al que espera', async () => {
    const semaphore = new Semaphore(1);
    const first = await semaphore.acquire(100);
    const pending = semaphore.acquire(2000);
    first?.();
    const second = await pending;
    expect(second).not.toBeNull();
  });

  it('liberar dos veces no abre un lugar de más', async () => {
    const semaphore = new Semaphore(1);
    const first = await semaphore.acquire(100);
    first?.();
    first?.();
    const a = await semaphore.acquire(100);
    const b = await semaphore.acquire(50);
    expect(a).not.toBeNull();
    expect(b).toBeNull();
  });

  it('se libera en finally aun con error', async () => {
    const semaphore = new Semaphore(1);
    const run = async () => {
      const release = await semaphore.acquire(100);
      try {
        throw new Error('boom');
      } finally {
        release?.();
      }
    };
    await expect(run()).rejects.toThrow('boom');
    expect(await semaphore.acquire(50)).not.toBeNull();
  });
});

describe('collectKnownSecrets', () => {
  it('reúne el JWT, la sal, la clave de Anthropic, el keyring y cada clave del keyring', () => {
    const config = {
      jwt: { secret: 'jwt-secret-1234567890' },
      analyticsSalt: 'sal-de-analitica',
      ai: { apiKey: 'clave-anthropic' },
      integrations: { keys: 'k1:AAAA1234,k2:BBBB5678' },
    } as unknown as AppConfig;
    const secrets = collectKnownSecrets(config, { GITHUB_SYNC_TOKEN: 'ghp_tokenejemplo' });
    expect(secrets).toEqual(
      expect.arrayContaining([
        'jwt-secret-1234567890',
        'sal-de-analitica',
        'clave-anthropic',
        'k1:AAAA1234,k2:BBBB5678',
        'AAAA1234',
        'BBBB5678',
        'ghp_tokenejemplo',
      ]),
    );
  });

  it('B2: suma la contraseña de DATABASE_URL (decodificada) y ADMIN_PASSWORD', () => {
    const config = {
      jwt: { secret: 'jwt-secret-1234567890' },
      analyticsSalt: 'sal-de-analitica',
      databaseUrl: 'postgresql://usuario:cl%40ve-de-la-base@localhost:5434/db?schema=public',
      ai: { apiKey: undefined },
      integrations: { keys: undefined },
    } as unknown as AppConfig;
    const secrets = collectKnownSecrets(config, { ADMIN_PASSWORD: 'pass-del-admin-123' });
    expect(secrets).toEqual(expect.arrayContaining(['cl@ve-de-la-base', 'pass-del-admin-123']));
  });

  it('B2: una DATABASE_URL sin contraseña o inválida no rompe', () => {
    const base = {
      jwt: { secret: 'jwt-secret-1234567890' },
      analyticsSalt: '',
      ai: {},
      integrations: {},
    };
    expect(
      collectKnownSecrets({ ...base, databaseUrl: 'no es una url' } as unknown as AppConfig, {}),
    ).toEqual(['jwt-secret-1234567890']);
    expect(
      collectKnownSecrets(
        { ...base, databaseUrl: 'postgresql://u@h/db' } as unknown as AppConfig,
        {},
      ),
    ).toEqual(['jwt-secret-1234567890']);
  });

  it('descarta valores vacíos', () => {
    const config = {
      jwt: { secret: 'jwt-secret-1234567890' },
      analyticsSalt: '',
      ai: { apiKey: undefined },
      integrations: { keys: undefined },
    } as unknown as AppConfig;
    expect(collectKnownSecrets(config, {})).toEqual(['jwt-secret-1234567890']);
  });
});
