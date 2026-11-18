import { ok } from '../../../shared/domain/result';
import { completion, MutableClock, ScriptedLlm } from '../../../../test/support/ai-doubles';
import { aiSmokeEvalSuite } from './ai-smoke.cases';
import { runEvalSuites } from './eval-harness';
import { LlmPort } from '../application/ports/llm.port';
import { RawMessage } from '../infrastructure/shared/interpret-message';
import { prepareCassetteForWrite } from './cassette-writer';
import { Cassette } from '../infrastructure/cassette/cassette-llm.adapter';
import { AiEvalCliDeps, runAiEvalCli } from './ai-eval.cli';

const KEY = 'clave-de-evals-de-prueba-no-real';
const clock = new MutableClock(new Date('2026-11-17T12:00:00Z'));

/** Adaptador que devuelve una respuesta cruda por caso y lleva la cuenta de las llamadas. */
class RecordingScriptedLlm extends ScriptedLlm {
  constructor(
    private readonly onResponse: (cacheKey: string, raw: RawMessage) => void,
    private readonly rawText = '{"estado":"ok"}',
  ) {
    super();
  }

  override complete<T>(request: Parameters<LlmPort['complete']>[0]) {
    this.onResponse(request.cacheKey, {
      content: [{ type: 'text', text: this.rawText }],
      stop_reason: 'end_turn',
      stop_details: null,
      usage: { input_tokens: 200, output_tokens: 8 },
      model: 'claude-haiku-5-5',
    });
    return super.complete<T>(request as never);
  }
}

function setup(
  env: Record<string, string | undefined>,
  options: { llm?: ScriptedLlm; rawText?: string } = {},
) {
  const logs: string[] = [];
  const errors: string[] = [];
  const written = new Map<string, string>();
  let llm: ScriptedLlm | undefined = options.llm;
  const deps: AiEvalCliDeps = {
    env,
    log: (line) => logs.push(line),
    error: (line) => errors.push(line),
    createLlm: (_key, onResponse) => {
      llm = options.llm ?? new RecordingScriptedLlm(onResponse, options.rawText);
      return llm;
    },
    writeFile: (path, content) => written.set(path, content),
    cassettesDir: '/cassettes',
    sdkVersion: '1.9.0',
    clock,
  };
  return { deps, logs, errors, written, llm: () => llm };
}

describe('ai:eval — las tres negativas salen con código 2 sin llamar', () => {
  it('sin AI_EVAL_API_KEY: código 2 y ninguna llamada', async () => {
    const { deps, errors, llm } = setup({ AI_EVAL_ALLOW_SPEND: '1' });
    expect(await runAiEvalCli([], deps)).toBe(2);
    expect(errors.join(' ')).toContain('AI_EVAL_API_KEY');
    expect(llm()).toBeUndefined();
  });

  it('con la clave de la API de la app pero sin la de evals, también se niega (no son la misma)', async () => {
    const { deps, errors } = setup({ ANTHROPIC_API_KEY: KEY, AI_EVAL_ALLOW_SPEND: '1' });
    expect(await runAiEvalCli([], deps)).toBe(2);
    expect(errors.join(' ')).toContain('AI_EVAL_API_KEY');
  });

  it('con la clave pero sin AI_EVAL_ALLOW_SPEND=1: código 2 y ninguna petición', async () => {
    const { deps, errors, llm } = setup({ AI_EVAL_API_KEY: KEY });
    expect(await runAiEvalCli([], deps)).toBe(2);
    expect(errors.join(' ')).toContain('AI_EVAL_ALLOW_SPEND=1');
    expect(llm()).toBeUndefined();
  });

  it('AI_EVAL_ALLOW_SPEND distinto de 1 tampoco alcanza', async () => {
    const { deps } = setup({ AI_EVAL_API_KEY: KEY, AI_EVAL_ALLOW_SPEND: 'true' });
    expect(await runAiEvalCli([], deps)).toBe(2);
  });

  it('las reservas por encima del tope: código 2 antes de llamar y lo informa', async () => {
    const llm = new ScriptedLlm();
    // Un conteo enorme hace que la reserva de cada caso supere un tope diminuto.
    llm.countResult = ok(90_000);
    const { deps, errors } = setup({ AI_EVAL_API_KEY: KEY, AI_EVAL_ALLOW_SPEND: '1' }, { llm });
    expect(await runAiEvalCli(['--max-usd', '0.0001'], deps)).toBe(2);
    expect(errors.join(' ')).toContain('supera el tope de la corrida');
    expect(llm.completeCalls).toBe(0);
  });

  it('B6: AI_EVAL_API_KEY igual a ANTHROPIC_API_KEY se niega sin llamar', async () => {
    const { deps, errors, llm } = setup({
      AI_EVAL_API_KEY: KEY,
      ANTHROPIC_API_KEY: KEY,
      AI_EVAL_ALLOW_SPEND: '1',
    });
    expect(await runAiEvalCli([], deps)).toBe(2);
    expect(errors.join(' ')).toContain('igual a ANTHROPIC_API_KEY');
    expect(llm()).toBeUndefined();
  });

  it('B6: con una clave distinta de la app sigue su camino', async () => {
    const { deps } = setup({
      AI_EVAL_API_KEY: KEY,
      ANTHROPIC_API_KEY: 'otra-clave-de-la-app',
      AI_EVAL_ALLOW_SPEND: '1',
    });
    expect(await runAiEvalCli([], deps)).not.toBe(2);
  });

  it('B6: NODE_ENV=production se niega sin llamar', async () => {
    const { deps, errors, llm } = setup({
      AI_EVAL_API_KEY: KEY,
      AI_EVAL_ALLOW_SPEND: '1',
      NODE_ENV: 'production',
    });
    expect(await runAiEvalCli([], deps)).toBe(2);
    expect(errors.join(' ')).toContain('NODE_ENV=production');
    expect(llm()).toBeUndefined();
  });

  it('B6: un tope mayor al techo de 2 USD se niega (con --max-usd y con AI_EVAL_MAX_USD)', async () => {
    const env = { AI_EVAL_API_KEY: KEY, AI_EVAL_ALLOW_SPEND: '1' };
    const a = setup(env);
    expect(await runAiEvalCli(['--max-usd', '2.01'], a.deps)).toBe(2);
    expect(a.errors.join(' ')).toContain('supera el techo');
    expect(a.llm()).toBeUndefined();
    const b = setup({ ...env, AI_EVAL_MAX_USD: '5' });
    expect(await runAiEvalCli([], b.deps)).toBe(2);
    expect(b.llm()).toBeUndefined();
  });

  it('B6: justo en el techo (2 USD) se permite', async () => {
    const { deps } = setup({ AI_EVAL_API_KEY: KEY, AI_EVAL_ALLOW_SPEND: '1' });
    expect(await runAiEvalCli(['--max-usd', '2'], deps)).not.toBe(2);
  });

  it('--max-usd inválido o tarea desconocida: código 2', async () => {
    const env = { AI_EVAL_API_KEY: KEY, AI_EVAL_ALLOW_SPEND: '1' };
    expect(await runAiEvalCli(['--max-usd', 'abc'], setup(env).deps)).toBe(2);
    expect(await runAiEvalCli(['--max-usd', '-1'], setup(env).deps)).toBe(2);
    expect(await runAiEvalCli(['--task', 'no.existe'], setup(env).deps)).toBe(2);
    expect(await runAiEvalCli(['--raro'], setup(env).deps)).toBe(2);
  });
});

describe('ai:eval — con permiso y tope suficiente (adaptador en memoria)', () => {
  const env = { AI_EVAL_API_KEY: KEY, AI_EVAL_ALLOW_SPEND: '1' };

  it('corre, informa tasas y costo, y sale 1 si una tarea queda bajo su umbral', async () => {
    // El adaptador siempre responde ok: los casos que esperan refusal/truncado no pasan → umbral 100 % no se cumple.
    const { deps, logs } = setup(env);
    expect(await runAiEvalCli([], deps)).toBe(1);
    expect(logs.join('\n')).toContain('ai.smoke');
    expect(logs.join('\n')).toContain('costo real');
  });

  it('el tope por defecto es de 2 USD y se informa', async () => {
    const { deps, logs } = setup(env);
    await runAiEvalCli([], deps);
    expect(logs[0]).toContain('tope de 2.000000 USD');
  });
});

describe('runEvalSuites — presupuesto en memoria', () => {
  it('corta en cuanto el gasto real llega al tope: las reservas siguientes se rechazan sin llamar', async () => {
    const llm = new ScriptedLlm();
    llm.countResult = ok(3000);
    // Cada llamada cuesta ~628 micro-USD y el tope es 600: la primera entra (reserva ~510), la
    // segunda ya no cabe.
    llm.defaultStep = ok(completion({ estado: 'ok' }, { inputTokens: 5000, outputTokens: 256 }));
    const [result] = await runEvalSuites([aiSmokeEvalSuite], {
      llm,
      capMicroUsd: 600,
      clock,
      knownSecrets: [],
    });
    expect(llm.completeCalls).toBe(1);
    expect(result.outcomes.map((o) => o.status)).toContain('BLOCKED');
    expect(result.meetsThreshold).toBe(false);
  });
});

describe('ai:eval --record', () => {
  const env = { AI_EVAL_API_KEY: KEY, AI_EVAL_ALLOW_SPEND: '1' };

  it('graba un cassette por caso con sus campos y sin la clave', async () => {
    const { deps, written } = setup(env);
    await runAiEvalCli(['--record'], deps);
    expect([...written.keys()].map((k) => k.split('\\').join('/')).sort()).toEqual([
      '/cassettes/ai.smoke/max-tokens.json',
      '/cassettes/ai.smoke/refusal.json',
      '/cassettes/ai.smoke/valido.json',
    ]);
    for (const text of written.values()) {
      expect(text).not.toContain(KEY);
      const cassette = JSON.parse(text) as Cassette;
      expect(cassette).toMatchObject({
        task: 'ai.smoke',
        promptVersion: 1,
        model: 'claude-haiku-5-5',
        sdkVersion: '1.9.0',
        pricingVerifiedAt: '2026-11-17',
      });
      expect(cassette.cacheKey).toMatch(/^[0-9a-f]{64}$/);
      expect(Object.keys(cassette)).not.toEqual(expect.arrayContaining(['headers', 'request_id']));
    }
  });

  it('se niega (código 2) y no escribe NINGUNO si la respuesta trae un sk-ant- que no se pudo redactar', async () => {
    // Demasiado corto para el patrón de redacción: sobrevive y el escaneo lo detecta.
    const { deps, written, errors } = setup(env, {
      rawText: '{"estado":"ok","nota":"sk-ant-abc"}',
    });
    expect(await runAiEvalCli(['--record'], deps)).toBe(2);
    expect(written.size).toBe(0);
    expect(errors.join(' ')).toContain('me niego a grabar');
  });

  it('se niega si la respuesta trae un email ajeno al dominio ficticio', async () => {
    const { deps, written } = setup(env, { rawText: '{"estado":"ok","nota":"x@gmail.com"}' });
    expect(await runAiEvalCli(['--record'], deps)).toBe(2);
    expect(written.size).toBe(0);
  });
});

describe('prepareCassetteForWrite', () => {
  const base: Cassette = {
    task: 'ai.smoke',
    promptVersion: 1,
    promptSha256: 'x',
    model: 'claude-haiku-5-5',
    cacheKey: 'k',
    recordedAt: '2026-11-17T00:00:00Z',
    sdkVersion: '1.9.0',
    pricingVerifiedAt: '2026-11-17',
    response: {
      content: [{ type: 'text', text: '{"estado":"ok"}' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 1 },
      model: 'claude-haiku-5-5',
    },
  };
  const withText = (text: string): Cassette => ({
    ...base,
    response: { ...base.response, content: [{ type: 'text', text }] },
  });

  it('redacta la clave conocida y un sk-ant- antes de escribir', () => {
    const result = prepareCassetteForWrite(
      withText(`hola ${KEY} y sk-ant-api03-${'q'.repeat(30)}`),
      KEY,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).not.toContain(KEY);
      expect(result.value).not.toContain('sk-ant-');
      expect(result.value).toContain('[Redacted]');
    }
  });

  it('no recorta textos largos de la respuesta', () => {
    const long = 'a'.repeat(2000);
    const result = prepareCassetteForWrite(withText(long), KEY);
    expect(result.ok && result.value.includes(long)).toBe(true);
  });

  it('se niega si queda un email que no es del dominio ficticio', () => {
    const result = prepareCassetteForWrite(withText('escribile a persona@gmail.com'), KEY);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('email');
  });

  it('acepta emails ficticios del ejemplo', () => {
    expect(prepareCassetteForWrite(withText('alex.rivera@example.com'), KEY).ok).toBe(true);
    expect(prepareCassetteForWrite(withText('jobs@empresa.example'), KEY).ok).toBe(true);
  });

  it('se niega si un sk- sobrevive a la redacción (autocontrol del escaneo)', () => {
    // Un valor con forma de clave que el patrón de redacción no cubre por ser demasiado corto.
    const result = prepareCassetteForWrite(withText('sk-ant-abc'), KEY);
    expect(result.ok).toBe(false);
  });
});
