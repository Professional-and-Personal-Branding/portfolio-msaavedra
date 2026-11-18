/**
 * E2E — arranque real del proceso con las variables de la IA (change `add-ai-foundation`, D2, D3,
 * spec `api-platform` § Variables de la IA validadas al arranque). Lanza `node dist/main` (el CI
 * corre `npm run build` antes de los e2e) en un puerto propio. Ninguna clave es real.
 */
import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';

const BACKEND = path.resolve(__dirname, '..');
const MAIN = path.join(BACKEND, 'dist', 'main.js');
const PORT = '3357';

/** Clave al azar de esta corrida: nunca se imprime ni se reutiliza. */
const API_KEY = `clave-e2e-${randomBytes(18).toString('hex')}`;

const MANAGED = [
  'AI_ENABLED',
  'AI_PROVIDER',
  'ANTHROPIC_API_KEY',
  'AI_MONTHLY_BUDGET_USD',
  'AI_REQUEST_TIMEOUT_MS',
  'AI_MAX_CONCURRENCY',
  'AI_MAX_INPUT_TOKENS',
  'AI_FAKE_SCENARIO',
  'NODE_ENV',
  'INTEGRATIONS_ENABLED',
  'INTEGRATIONS_KEYS',
  'INTEGRATIONS_ACTIVE_KEY',
];

function childEnv(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, PORT, LOG_LEVEL: 'error' };
  for (const name of MANAGED) delete env[name];
  for (const [name, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[name];
    else env[name] = value;
  }
  return env;
}

interface Exit {
  code: number | null;
  output: string;
}

function runUntilExit(env: NodeJS.ProcessEnv, timeoutMs = 30_000): Promise<Exit> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [MAIN], { cwd: BACKEND, env });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`el proceso no terminó en ${timeoutMs} ms:\n${output}`));
    }, timeoutMs);
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ code, output });
    });
  });
}

async function waitForLive(child: ChildProcess, timeoutMs = 30_000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`el proceso terminó con ${child.exitCode}`);
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/health/live`);
      return res.status;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error('la API no respondió /health/live a tiempo');
}

async function boots(overrides: Record<string, string | undefined>): Promise<number> {
  const child = spawn(process.execPath, [MAIN], { cwd: BACKEND, env: childEnv(overrides) });
  try {
    return await waitForLive(child);
  } finally {
    child.kill();
  }
}

describe('Arranque con las variables de la IA (e2e, proceso real)', () => {
  beforeAll(() => {
    if (!fs.existsSync(MAIN)) {
      throw new Error('Falta backend/dist/main.js: ejecutá `npm run build` antes de este e2e');
    }
  });

  it('encendida con anthropic y sin clave: sale con código distinto de 0 y nombra ANTHROPIC_API_KEY', async () => {
    const { code, output } = await runUntilExit(
      childEnv({ AI_ENABLED: 'true', AI_PROVIDER: 'anthropic' }),
    );
    expect(code).not.toBe(0);
    expect(output).toContain('ANTHROPIC_API_KEY');
  }, 40_000);

  it('AI_PROVIDER=fake sin clave y NODE_ENV=development arranca', async () => {
    expect(await boots({ AI_ENABLED: 'true', AI_PROVIDER: 'fake', NODE_ENV: 'development' })).toBe(
      200,
    );
  }, 40_000);

  it('AI_PROVIDER=fake con NODE_ENV=production no arranca y nombra AI_PROVIDER', async () => {
    const { code, output } = await runUntilExit(
      childEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'x'.repeat(48),
        ANALYTICS_SALT: 'y'.repeat(44),
        FRONTEND_URL: 'https://portafolio.test',
        AI_PROVIDER: 'fake',
      }),
    );
    expect(code).not.toBe(0);
    expect(output).toContain('AI_PROVIDER');
  }, 40_000);

  it('AI_MONTHLY_BUDGET_USD=-1 no arranca y nombra la variable', async () => {
    const { code, output } = await runUntilExit(childEnv({ AI_MONTHLY_BUDGET_USD: '-1' }));
    expect(code).not.toBe(0);
    expect(output).toContain('AI_MONTHLY_BUDGET_USD');
  }, 40_000);

  it('sin ninguna variable AI_* arranca con la IA apagada', async () => {
    expect(await boots({})).toBe(200);
  }, 40_000);

  it('el arranque que falla por otra variable no imprime el valor de la clave', async () => {
    const { code, output } = await runUntilExit(
      childEnv({
        JWT_SECRET: 'corto',
        AI_ENABLED: 'true',
        AI_PROVIDER: 'anthropic',
        ANTHROPIC_API_KEY: API_KEY,
      }),
    );
    expect(code).not.toBe(0);
    expect(output).toContain('JWT_SECRET');
    expect(output).not.toContain(API_KEY);
  }, 40_000);

  it('encendida con anthropic y una clave de prueba arranca sin llamar a Anthropic (el cliente solo se construye)', async () => {
    expect(
      await boots({ AI_ENABLED: 'true', AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: API_KEY }),
    ).toBe(200);
  }, 40_000);
});
