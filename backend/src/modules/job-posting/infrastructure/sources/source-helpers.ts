import { fail, ok, Result } from '../../../../shared/domain/result';
import { MAX_URL_LENGTH } from '../../domain/services/check-url-policy';
import { ImportFailure } from '../../domain/errors/import-failure';
import { WorkplaceType } from '../../domain/entities/job-posting.entity';

/** Registro JSON con claves desconocidas: se lee siempre con estrechamiento, sin `any`. */
export type JsonRecord = Record<string, unknown>;

export function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

/** Texto no vacío (recortado) o `null`; los números se aceptan como texto. */
export function asText(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function clip(value: string | null, max: number): string | null {
  return value === null ? null : value.slice(0, max);
}

export function parseJson(body: string): Result<unknown, ImportFailure> {
  try {
    return ok(JSON.parse(body) as unknown);
  } catch {
    return fail(unparseable());
  }
}

export function unparseable(): ImportFailure {
  return ImportFailure.withHint('unparseable', 'No pudimos leer esa vacante');
}

export function noPostingFound(): ImportFailure {
  return ImportFailure.withHint('no-posting-found', 'No encontramos una vacante en esa página');
}

/** Solo https y de largo razonable; si no, `null` (el `applyUrl` nunca es http). */
export function httpsUrlOrNull(value: unknown): string | null {
  const text = asText(value);
  if (text === null || text.length > MAX_URL_LENGTH) return null;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function dateOrNull(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `acme-ejemplo` / `acme_ejemplo` → `Acme Ejemplo`. */
export function humanizeSlug(slug: string): string {
  return slug
    .split(/[-_.]+/)
    .filter((part) => part !== '')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function workplaceFromWord(value: unknown): WorkplaceType | null {
  const word = (asText(value) ?? '').toLowerCase().replace(/[^a-z]/g, '');
  if (word === 'remote' || word === 'telecommute') return 'REMOTE';
  if (word === 'hybrid') return 'HYBRID';
  if (word === 'onsite') return 'ONSITE';
  return null;
}
