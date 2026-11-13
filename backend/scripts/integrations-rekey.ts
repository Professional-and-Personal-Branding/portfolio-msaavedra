/**
 * Recifra las credenciales de integraciones con la clave activa (change
 * `add-integrations-foundation`, D13).
 *
 *   npm run integrations:rekey              → simulación: informa y no escribe
 *   npm run integrations:rekey -- --apply   → recifra
 *
 * Rotación: agregar `k2` a INTEGRATIONS_KEYS → INTEGRATIONS_ACTIVE_KEY=k2 → redeploy → este
 * script con --apply → quitar `k1`. Es idempotente: la segunda corrida dice «0 filas para
 * recifrar». Nunca imprime secretos ni claves.
 *
 * Salida: 0 ok (también la simulación y «0 filas») · 1 argumento desconocido o falla ·
 * 2 configuración faltante o inválida, o alguna fila nombra una clave que no está en el keyring.
 */
import { PrismaClient } from '@prisma/client';
import { parseKeyring } from '../src/config/integrations-keys';
import { AesGcmSecretCipher } from '../src/modules/integrations/infrastructure/crypto/aes-gcm-secret-cipher';
import { Keyring } from '../src/modules/integrations/infrastructure/crypto/keyring';
import {
  applyRekey,
  CredentialStore,
  formatRekeyReport,
  parseRekeyArgs,
  planRekey,
} from './lib/integrations-rekey';
import { describeDatabaseTarget } from './lib/seed-guard';

async function main(): Promise<number> {
  const args = parseRekeyArgs(process.argv.slice(2));
  if (!args.ok) {
    console.error(`❌ ${args.error}`);
    return 1;
  }
  const prisma = new PrismaClient();
  try {
    // PrismaClient ya cargó el .env: las variables se leen después de instanciarlo.
    const rawKeys = process.env.INTEGRATIONS_KEYS;
    const activeKey = process.env.INTEGRATIONS_ACTIVE_KEY;
    const parsed = parseKeyring(rawKeys);
    if (!rawKeys || parsed.keys.size === 0 || parsed.issues.length > 0) {
      console.error(
        `❌ INTEGRATIONS_KEYS falta o es inválida${parsed.issues.length > 0 ? `: ${parsed.issues.join('; ')}` : ''}.`,
      );
      return 2;
    }
    if (!activeKey || !parsed.keys.has(activeKey)) {
      console.error('❌ INTEGRATIONS_ACTIVE_KEY falta o no figura en INTEGRATIONS_KEYS.');
      return 2;
    }

    const cipher = new AesGcmSecretCipher(Keyring.fromConfig(rawKeys, activeKey));
    const store: CredentialStore = {
      listAll: () =>
        prisma.integrationCredential.findMany({
          select: { provider: true, ciphertext: true, keyId: true },
          orderBy: { provider: 'asc' },
        }),
      updateIfUnchanged: async (provider, oldCiphertext, newCiphertext, newKeyId) => {
        const result = await prisma.integrationCredential.updateMany({
          where: { provider, ciphertext: oldCiphertext },
          data: { ciphertext: newCiphertext, keyId: newKeyId },
        });
        return result.count === 1;
      },
    };

    const plan = planRekey(await store.listAll(), cipher, new Set(parsed.keys.keys()));
    const result = args.value.apply ? await applyRekey(store, cipher, plan) : undefined;
    console.log(
      formatRekeyReport({
        plan,
        apply: args.value.apply,
        activeKeyId: activeKey,
        target: describeDatabaseTarget(process.env.DATABASE_URL),
        result,
      }),
    );
    const failed = plan.unknownKeyIds.length > 0 || (result?.unreadable ?? 0) > 0;
    return failed ? 2 : 0;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((e: unknown) => {
    console.error('❌ Error en integrations:rekey:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
