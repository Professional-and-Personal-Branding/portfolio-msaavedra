/**
 * E2E — arranque real del proceso con las variables de integraciones (change
 * `add-integrations-foundation`, D11, spec `api-platform`). Lanza `node dist/main` (el CI corre
 * `npm run build` antes de los e2e) en un puerto propio.
 */
import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';

const BACKEND = path.resolve(__dirname, '..');
const MAIN = path.join(BACKEND, 'dist', 'main.js');
const PORT = '3364';

const KEY = `k1:${randomBytes(32).toString('base64')}`;

function childEnv(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, PORT, LOG_LEVEL: 'error' };
  for (const name of [
    'INTEGRATIONS_ENABLED',
    'FAKE_PROVIDER_TOKEN',
    'INTEGRATIONS_KEYS',
    'INTEGRATIONS_ACTIVE_KEY',
    'INTEGRATIONS_SCHEDULER_ENABLED',
    'GITHUB_SYNC_TOKEN',
    'GITHUB_TRANSPORT',
    'NODE_ENV',
  ]) {
    delete env[name];
  }
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

describe('Arranque con variables de integraciones (e2e, proceso real)', () => {
  beforeAll(() => {
    if (!fs.existsSync(MAIN)) {
      throw new Error('Falta backend/dist/main.js: ejecutá `npm run build` antes de este e2e');
    }
  });

  it('INTEGRATIONS_ENABLED=fake sin FAKE_PROVIDER_TOKEN arranca (el secreto es opcional) y /health/live responde 200', async () => {
    const child = spawn(process.execPath, [MAIN], {
      cwd: BACKEND,
      env: childEnv({
        INTEGRATIONS_ENABLED: 'fake',
        INTEGRATIONS_KEYS: KEY,
        INTEGRATIONS_ACTIVE_KEY: 'k1',
      }),
    });
    try {
      expect(await waitForLive(child)).toBe(200);
    } finally {
      child.kill();
    }
  }, 40_000);

  it('INTEGRATIONS_ENABLED=fake sin keyring sale con código distinto de 0 y nombra INTEGRATIONS_KEYS', async () => {
    const { code, output } = await runUntilExit(childEnv({ INTEGRATIONS_ENABLED: 'fake' }));
    expect(code).not.toBe(0);
    expect(output).toContain('INTEGRATIONS_KEYS');
  }, 40_000);

  it('sin INTEGRATIONS_ENABLED y sin el token, /health/live responde 200', async () => {
    const child = spawn(process.execPath, [MAIN], { cwd: BACKEND, env: childEnv({}) });
    try {
      expect(await waitForLive(child)).toBe(200);
    } finally {
      child.kill();
    }
  }, 40_000);

  it('con NODE_ENV=production e INTEGRATIONS_ENABLED=fake falla nombrando INTEGRATIONS_ENABLED', async () => {
    const { code, output } = await runUntilExit(
      childEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'x'.repeat(48),
        FRONTEND_URL: 'https://portafolio.test',
        INTEGRATIONS_ENABLED: 'fake',
        FAKE_PROVIDER_TOKEN: 'token-de-prueba',
        INTEGRATIONS_KEYS: KEY,
        INTEGRATIONS_ACTIVE_KEY: 'k1',
      }),
    );
    expect(code).not.toBe(0);
    expect(output).toContain('INTEGRATIONS_ENABLED');
  }, 40_000);

  it('INTEGRATIONS_KEYS sin INTEGRATIONS_ACTIVE_KEY y sin proveedores sale con código distinto de 0 y nombra la variable (M1)', async () => {
    const { code, output } = await runUntilExit(childEnv({ INTEGRATIONS_KEYS: KEY }));
    expect(code).not.toBe(0);
    expect(output).toContain('INTEGRATIONS_ACTIVE_KEY');
  }, 40_000);

  // add-github-code-evidence (D1, D15, D16)
  it('INTEGRATIONS_ENABLED=github sin GITHUB_SYNC_TOKEN arranca (el token es opcional) y /health/live responde 200', async () => {
    const child = spawn(process.execPath, [MAIN], {
      cwd: BACKEND,
      env: childEnv({
        INTEGRATIONS_ENABLED: 'github',
        INTEGRATIONS_KEYS: KEY,
        INTEGRATIONS_ACTIVE_KEY: 'k1',
      }),
    });
    try {
      expect(await waitForLive(child)).toBe(200);
    } finally {
      child.kill();
    }
  }, 40_000);

  it('sin GITHUB_TRANSPORT arranca con el transporte http por defecto', async () => {
    const child = spawn(process.execPath, [MAIN], { cwd: BACKEND, env: childEnv({}) });
    try {
      expect(await waitForLive(child)).toBe(200);
    } finally {
      child.kill();
    }
  }, 40_000);

  it('un GITHUB_TRANSPORT desconocido falla nombrando la variable y sin imprimir el valor', async () => {
    const { code, output } = await runUntilExit(childEnv({ GITHUB_TRANSPORT: 'proxy-secreto' }));
    expect(code).not.toBe(0);
    expect(output).toContain('GITHUB_TRANSPORT');
    expect(output).not.toContain('proxy-secreto');
  }, 40_000);

  it('GITHUB_TRANSPORT=fixture con NODE_ENV=production falla nombrando la variable', async () => {
    const { code, output } = await runUntilExit(
      childEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'x'.repeat(48),
        FRONTEND_URL: 'https://portafolio.test',
        GITHUB_TRANSPORT: 'fixture',
        GITHUB_SYNC_TOKEN: 'token-de-prueba-no-real',
      }),
    );
    expect(code).not.toBe(0);
    expect(output).toContain('GITHUB_TRANSPORT');
    expect(output).not.toContain('token-de-prueba-no-real');
  }, 40_000);

  it('un cron inválido termina con código distinto de 0 y nombra INTEGRATIONS_SYNC_CRON', async () => {
    const { code, output } = await runUntilExit(
      childEnv({ INTEGRATIONS_SYNC_CRON: 'todos los días' }),
    );
    expect(code).not.toBe(0);
    expect(output).toContain('INTEGRATIONS_SYNC_CRON');
    expect(output).not.toContain('todos los días');
  }, 40_000);
});
