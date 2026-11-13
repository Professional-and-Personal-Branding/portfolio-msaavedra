/**
 * E2E — `npm run integrations:rekey` (change `add-integrations-foundation`, D13) contra la base
 * de e2e. Crea y borra sus propias credenciales de prueba (proveedores `rk-*`); las claves del
 * keyring se generan al azar en cada corrida y la salida capturada no puede contener secretos.
 */
import { spawnSync } from 'child_process';
import { randomBytes } from 'crypto';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { credentialAad } from '../src/modules/integrations/application/ports/secret-cipher.port';
import { AesGcmSecretCipher } from '../src/modules/integrations/infrastructure/crypto/aes-gcm-secret-cipher';
import { Keyring } from '../src/modules/integrations/infrastructure/crypto/keyring';
import {
  applyRekey,
  CredentialStore,
  parseRekeyArgs,
  planRekey,
} from '../scripts/lib/integrations-rekey';

const BACKEND = path.resolve(__dirname, '..');
const TSX = path.join(BACKEND, 'node_modules', 'tsx', 'dist', 'cli.mjs');

const k0 = randomBytes(32);
const k1 = randomBytes(32);
const k2 = randomBytes(32);
const KEYRING_ENV = `k1:${k1.toString('base64')},k2:${k2.toString('base64')}`;
const SECRETS: Record<string, string> = {
  'rk-a': `secreto-a-${randomBytes(8).toString('hex')}`,
  'rk-b': `secreto-b-${randomBytes(8).toString('hex')}`,
  'rk-c': `secreto-c-${randomBytes(8).toString('hex')}`,
};

const cipherWith = (keys: Array<[string, Buffer]>, active: string): AesGcmSecretCipher =>
  new AesGcmSecretCipher(new Keyring(new Map(keys), active));

describe('integrations:rekey (e2e)', () => {
  const prisma = new PrismaClient();

  function runScript(args: string[]) {
    const result = spawnSync(process.execPath, [TSX, 'scripts/integrations-rekey.ts', ...args], {
      cwd: BACKEND,
      env: {
        ...process.env,
        INTEGRATIONS_KEYS: KEYRING_ENV,
        INTEGRATIONS_ACTIVE_KEY: 'k2',
      },
      encoding: 'utf-8',
    });
    return { code: result.status, output: `${result.stdout}${result.stderr}` };
  }

  async function seed(provider: string, keyring: AesGcmSecretCipher): Promise<string> {
    const ciphertext = keyring.encrypt(SECRETS[provider], credentialAad(provider));
    await prisma.integrationCredential.upsert({
      where: { provider },
      create: { provider, ciphertext, keyId: keyring.activeKeyId },
      update: { ciphertext, keyId: keyring.activeKeyId },
    });
    return ciphertext;
  }

  const ciphertextOf = async (provider: string): Promise<string> =>
    (await prisma.integrationCredential.findUniqueOrThrow({ where: { provider } })).ciphertext;

  const cleanup = () =>
    prisma.integrationCredential.deleteMany({ where: { provider: { startsWith: 'rk-' } } });

  beforeAll(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('parseRekeyArgs acepta solo --apply', () => {
    expect(parseRekeyArgs([])).toEqual({ ok: true, value: { apply: false } });
    expect(parseRekeyArgs(['--apply'])).toEqual({ ok: true, value: { apply: true } });
    expect(parseRekeyArgs(['--otra']).ok).toBe(false);
  });

  it('simulación, --apply, idempotencia y fila con clave desconocida', async () => {
    const withK1 = cipherWith([['k1', k1]], 'k1');
    const before = {
      a: await seed('rk-a', withK1),
      b: await seed('rk-b', withK1),
    };

    // Simulación: informa y no escribe.
    const dry = runScript([]);
    expect(dry.code).toBe(0);
    expect(dry.output).toContain('2 filas para recifrar');
    expect(await ciphertextOf('rk-a')).toBe(before.a);
    expect(await ciphertextOf('rk-b')).toBe(before.b);

    // --apply: recifra las dos con la activa (k2) y sale con 0.
    const applied = runScript(['--apply']);
    expect(applied.code).toBe(0);
    expect(applied.output).toContain('Recifradas: 2');
    const active = cipherWith(
      [
        ['k1', k1],
        ['k2', k2],
      ],
      'k2',
    );
    for (const provider of ['rk-a', 'rk-b']) {
      const stored = await prisma.integrationCredential.findUniqueOrThrow({ where: { provider } });
      expect(stored.keyId).toBe('k2');
      expect(active.keyIdOf(stored.ciphertext)).toBe('k2');
      expect(active.decrypt(stored.ciphertext, credentialAad(provider))).toEqual({
        ok: true,
        value: SECRETS[provider],
      });
    }

    // Segunda corrida: nada que hacer y sale con 0.
    const again = runScript(['--apply']);
    expect(again.code).toBe(0);
    expect(again.output).toContain('0 filas para recifrar');

    // Una fila con una clave fuera del keyring queda intacta y sale con 2.
    const orphan = await seed('rk-c', cipherWith([['k0', k0]], 'k0'));
    const withUnknown = runScript(['--apply']);
    expect(withUnknown.code).toBe(2);
    expect(withUnknown.output).toContain('no está en INTEGRATIONS_KEYS');
    expect(await ciphertextOf('rk-c')).toBe(orphan);

    // La salida capturada nunca contiene secretos ni claves.
    const everything = [dry, applied, again, withUnknown].map((r) => r.output).join('\n');
    for (const secret of Object.values(SECRETS)) expect(everything).not.toContain(secret);
    for (const key of [k0, k1, k2]) expect(everything).not.toContain(key.toString('base64'));
  }, 120_000);

  it('sin keyring o con una clave activa inexistente sale con 2', () => {
    const base = { ...process.env };
    const run = (extra: Record<string, string>) =>
      spawnSync(process.execPath, [TSX, 'scripts/integrations-rekey.ts'], {
        cwd: BACKEND,
        env: { ...base, INTEGRATIONS_KEYS: '', INTEGRATIONS_ACTIVE_KEY: '', ...extra },
        encoding: 'utf-8',
      });
    expect(run({}).status).toBe(2);
    expect(run({ INTEGRATIONS_KEYS: KEYRING_ENV, INTEGRATIONS_ACTIVE_KEY: 'k9' }).status).toBe(2);
  }, 60_000);

  describe('lógica pura', () => {
    it('applyRekey no pisa una fila que cambió en el medio y cuenta las ilegibles', async () => {
      const cipher = cipherWith(
        [
          ['k1', k1],
          ['k2', k2],
        ],
        'k2',
      );
      const old = cipherWith([['k1', k1]], 'k1').encrypt('x', credentialAad('rk-a'));
      const rows = [
        { provider: 'rk-a', ciphertext: old, keyId: 'k1' },
        { provider: 'rk-b', ciphertext: old, keyId: 'k1' }, // dato asociado de otro proveedor
      ];
      const plan = planRekey(rows, cipher, new Set(['k1', 'k2']));
      expect(plan.toRekey).toHaveLength(2);
      const store: CredentialStore = {
        listAll: () => Promise.resolve(rows),
        updateIfUnchanged: () => Promise.resolve(false),
      };
      expect(await applyRekey(store, cipher, plan)).toEqual({
        rekeyed: 0,
        skipped: 1,
        unreadable: 1,
      });
    });
  });
});
