import { createHash } from 'crypto';

/** Valor serializable a JSON. */
export type CanonicalValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly CanonicalValue[]
  | { readonly [key: string]: CanonicalValue };

/** JSON canónico: claves ordenadas y sin `undefined` (D11). */
export function canonicalJson(value: CanonicalValue): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${(value as readonly CanonicalValue[]).map((item) => canonicalJson(item)).join(',')}]`;
  }
  const record = value as { readonly [key: string]: CanonicalValue };
  const entries = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
  return `{${entries.join(',')}}`;
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Hash de la entrada canónica: es lo único que se guarda de ella. */
export function hashInput(input: CanonicalValue): string {
  return sha256Hex(canonicalJson(input));
}

export interface CacheKeyParts {
  readonly task: string;
  readonly promptVersion: number;
  readonly promptHash: string;
  readonly model: string;
  readonly effort: string;
  readonly thinking: string;
  readonly maxTokens: number;
  readonly schemaVersion: number;
  readonly input: CanonicalValue;
}

/** Clave de caché (D11): SHA-256 del JSON canónico de todo lo que cambia el resultado. */
export function buildCacheKey(parts: CacheKeyParts): string {
  return sha256Hex(canonicalJson({ ...parts }));
}
