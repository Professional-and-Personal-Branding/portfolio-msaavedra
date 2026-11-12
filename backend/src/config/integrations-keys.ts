/**
 * Keyring de las credenciales de integraciones (D12): `INTEGRATIONS_KEYS="k1:<base64>,k2:<…>"`.
 * Cada clave son exactamente 32 bytes (AES-256). Las funciones devuelven descripciones de los
 * problemas que NUNCA incluyen el valor de una clave.
 */
export const INTEGRATION_KEY_BYTES = 32;
const KEY_ID = /^[a-z0-9]{1,16}$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Clave de ejemplo del `.env.example` (32 bytes). Jamás debe llegar a producción: la
 * validación del arranque la rechaza.
 */
export const EXAMPLE_INTEGRATIONS_KEY = 'ZWplbXBsby1OTy1VU0FSLWNsYXZlLWRlLTMyYnl0ZXM=';

export interface ParsedKeyring {
  readonly keys: ReadonlyMap<string, Buffer>;
  /** Valores base64 tal como vinieron, para comparar contra reglas de producción. */
  readonly rawValues: readonly string[];
  readonly issues: readonly string[];
}

export function parseKeyring(raw: string | undefined): ParsedKeyring {
  const keys = new Map<string, Buffer>();
  const rawValues: string[] = [];
  const issues: string[] = [];
  const entries = (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  for (const entry of entries) {
    const separator = entry.indexOf(':');
    const id = separator === -1 ? '' : entry.slice(0, separator);
    const value = separator === -1 ? '' : entry.slice(separator + 1);
    if (!KEY_ID.test(id)) {
      issues.push('INTEGRATIONS_KEYS: cada entrada debe ser <id>:<base64> con id [a-z0-9]{1,16}');
      continue;
    }
    if (keys.has(id)) {
      issues.push(`INTEGRATIONS_KEYS: el id "${id}" está repetido`);
      continue;
    }
    const decoded = BASE64.test(value) ? Buffer.from(value, 'base64') : Buffer.alloc(0);
    if (decoded.length !== INTEGRATION_KEY_BYTES) {
      issues.push(
        `INTEGRATIONS_KEYS: la clave "${id}" debe ser base64 de exactamente ${INTEGRATION_KEY_BYTES} bytes`,
      );
      continue;
    }
    keys.set(id, decoded);
    rawValues.push(value);
  }
  return { keys, rawValues, issues };
}
