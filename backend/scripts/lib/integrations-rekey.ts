/**
 * Lógica de `npm run integrations:rekey` (change `add-integrations-foundation`, D13): vuelve a
 * cifrar con la clave activa las credenciales que quedaron con otra del keyring. Idempotente.
 * Nunca imprime secretos ni claves: solo cantidades, ids de clave y nombres de proveedor.
 */
import {
  credentialAad,
  SecretCipher,
} from '../../src/modules/integrations/application/ports/secret-cipher.port';

export interface RekeyArgs {
  readonly apply: boolean;
}

export type ParsedRekeyArgs = { ok: true; value: RekeyArgs } | { ok: false; error: string };

/** Solo acepta `--apply`; cualquier otro argumento es un error de uso (código 1). */
export function parseRekeyArgs(argv: readonly string[]): ParsedRekeyArgs {
  let apply = false;
  for (const arg of argv) {
    if (arg === '--apply') apply = true;
    else {
      return {
        ok: false,
        error: `Argumento desconocido: ${arg}. Uso: npm run integrations:rekey [-- --apply]`,
      };
    }
  }
  return { ok: true, value: { apply } };
}

export interface CredentialRow {
  readonly provider: string;
  readonly ciphertext: string;
  readonly keyId: string;
}

/** Lo mínimo que necesita el rekey de la base: el script lo implementa con Prisma. */
export interface CredentialStore {
  listAll(): Promise<CredentialRow[]>;
  updateIfUnchanged(
    provider: string,
    oldCiphertext: string,
    newCiphertext: string,
    newKeyId: string,
  ): Promise<boolean>;
}

export interface RekeyPlan {
  readonly total: number;
  /** Filas ya cifradas con la clave activa. */
  readonly alreadyActive: number;
  /** Filas para recifrar, por `kid` de origen. */
  readonly toRekeyByKeyId: Readonly<Record<string, number>>;
  readonly toRekey: readonly CredentialRow[];
  /** Filas que nombran un `kid` que no está en el keyring: no se tocan (salida 2). */
  readonly unknownKeyIds: readonly CredentialRow[];
}

/**
 * Clasifica cada fila por la clave con que está cifrada. El `kid` sale del payload (no de la
 * columna `keyId`, que es informativa): es lo que el cifrador usa para descifrar.
 */
export function planRekey(
  rows: readonly CredentialRow[],
  cipher: SecretCipher,
  keyringIds: ReadonlySet<string>,
): RekeyPlan {
  const toRekey: CredentialRow[] = [];
  const unknown: CredentialRow[] = [];
  const byKey: Record<string, number> = {};
  let alreadyActive = 0;
  for (const row of rows) {
    const kid = cipher.keyIdOf(row.ciphertext);
    if (kid === null || !keyringIds.has(kid)) {
      unknown.push(row);
    } else if (!cipher.needsRekey(row.ciphertext)) {
      alreadyActive += 1;
    } else {
      toRekey.push(row);
      byKey[kid] = (byKey[kid] ?? 0) + 1;
    }
  }
  return {
    total: rows.length,
    alreadyActive,
    toRekeyByKeyId: byKey,
    toRekey,
    unknownKeyIds: unknown,
  };
}

export interface RekeyResult {
  readonly rekeyed: number;
  /** Filas que otro proceso cambió en el medio (no se pisan). */
  readonly skipped: number;
  /** Filas que no se pudieron descifrar con su clave. */
  readonly unreadable: number;
}

/** Descifra cada fila con su clave y la vuelve a cifrar con la activa, sin pisar cambios ajenos. */
export async function applyRekey(
  store: CredentialStore,
  cipher: SecretCipher,
  plan: RekeyPlan,
): Promise<RekeyResult> {
  let rekeyed = 0;
  let skipped = 0;
  let unreadable = 0;
  for (const row of plan.toRekey) {
    const aad = credentialAad(row.provider);
    const plain = cipher.decrypt(row.ciphertext, aad);
    if (!plain.ok) {
      unreadable += 1;
      continue;
    }
    const next = cipher.encrypt(plain.value, aad);
    const updated = await store.updateIfUnchanged(
      row.provider,
      row.ciphertext,
      next,
      cipher.activeKeyId,
    );
    if (updated) rekeyed += 1;
    else skipped += 1;
  }
  return { rekeyed, skipped, unreadable };
}

export function formatRekeyReport(input: {
  plan: RekeyPlan;
  apply: boolean;
  activeKeyId: string;
  target: string;
  result?: RekeyResult;
}): string {
  const { plan, apply, activeKeyId, target, result } = input;
  const lines = [
    `Base: ${target}`,
    `Clave activa: ${activeKeyId}`,
    `Credenciales guardadas: ${plan.total} (${plan.alreadyActive} ya con la clave activa)`,
  ];
  const origins = Object.entries(plan.toRekeyByKeyId);
  if (plan.toRekey.length === 0) {
    lines.push('0 filas para recifrar');
  } else {
    lines.push(
      `${plan.toRekey.length} filas para recifrar (${origins.map(([kid, n]) => `${kid}: ${n}`).join(', ')}): ${plan.toRekey.map((r) => r.provider).join(', ')}`,
    );
  }
  if (plan.unknownKeyIds.length > 0) {
    lines.push(
      `⚠️  ${plan.unknownKeyIds.length} filas nombran una clave que no está en INTEGRATIONS_KEYS (no se tocan): ${plan.unknownKeyIds.map((r) => r.provider).join(', ')}. Reingresá esas credenciales desde el panel.`,
    );
  }
  if (!apply) {
    lines.push(plan.toRekey.length > 0 ? 'Simulación: no se escribió nada. Usá -- --apply.' : '');
  } else if (result) {
    lines.push(
      `Recifradas: ${result.rekeyed}` +
        (result.skipped > 0 ? ` · saltadas por un cambio en el medio: ${result.skipped}` : '') +
        (result.unreadable > 0 ? ` · ilegibles: ${result.unreadable}` : ''),
    );
  }
  return lines.filter((line) => line !== '').join('\n');
}
