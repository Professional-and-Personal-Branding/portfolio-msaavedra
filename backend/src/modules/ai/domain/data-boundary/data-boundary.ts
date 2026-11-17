import { fail, ok, Result } from '../../../../shared/domain/result';
import { ForbiddenDataError } from '../errors/ai.errors';

/** JSON puro: lo único que puede viajar en un payload. */
export type JsonValue =
  string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/**
 * Lo que una tarea quiere enviar. `structured` son campos del CV (valores prohibidos bloquean);
 * `freeText` son textos pegados por una persona (p. ej. una vacante): ahí emails y teléfonos se
 * redactan y solo las credenciales bloquean (change `add-ai-foundation`, D13 y P6).
 */
export interface LlmPayload {
  readonly structured: JsonValue;
  readonly freeText: Readonly<Record<string, string>>;
}

export interface RedactionCounts {
  readonly emails: number;
  readonly phones: number;
}

export interface SafePayload {
  readonly payload: LlmPayload;
  readonly redactions: RedactionCounts;
}

/** Normaliza una clave para compararla: minúsculas y sin separadores. */
export function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Claves que contienen estas partes están prohibidas, sea cual sea su nivel. */
const FORBIDDEN_KEY_PARTS: readonly string[] = [
  'email',
  'password',
  'token',
  'secret',
  'apikey',
  'cookie',
  'iphash',
  'sessionversion',
  'useragent',
  'referrer',
  'credential',
  'ciphertext',
  'phone',
  // Variantes en español (B1).
  'correo',
  'mail',
  'telefono',
  'celular',
  'contrasena',
  'clave',
];
/** Palabras cortas y ambiguas: solo coincidencia exacta (`hash`, `salt`). */
const FORBIDDEN_KEY_EXACT: readonly string[] = ['hash', 'salt', 'ip'];

export function isForbiddenKey(key: string): boolean {
  const normalized = normalizeKey(key);
  if (normalized === '') return false;
  return (
    FORBIDDEN_KEY_EXACT.includes(normalized) ||
    FORBIDDEN_KEY_PARTS.some((part) => normalized.includes(part))
  );
}

interface NamedPattern {
  readonly name: string;
  readonly regex: RegExp;
}

/** Credenciales y secretos: bloquean en cualquier campo, también en texto libre. */
const CREDENTIAL_PATTERNS: readonly NamedPattern[] = [
  { name: 'clave de Anthropic (sk-ant-)', regex: /sk-ant-[A-Za-z0-9_-]{8,}/ },
  { name: 'token de GitHub (ghp_)', regex: /\bgh[pousr]_[A-Za-z0-9]{10,}/ },
  { name: 'token de GitHub (github_pat_)', regex: /github_pat_[A-Za-z0-9_]{10,}/ },
  { name: 'JWT', regex: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/ },
  { name: 'cabecera Bearer', regex: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/i },
];

const IPV4_OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const HEX4 = '[0-9a-fA-F]{1,4}';

/** Solo bloquean en campos estructurados. */
const STRUCTURED_ONLY_PATTERNS: readonly NamedPattern[] = [
  { name: 'dirección de email', regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  {
    name: 'dirección IPv4',
    regex: new RegExp(`(?<![\\d.])${IPV4_OCTET}(?:\\.${IPV4_OCTET}){3}(?![\\d.])`),
  },
  {
    name: 'dirección IPv6',
    regex: new RegExp(
      `(?<![\\w:])(?:(?:${HEX4}:){7}${HEX4}|(?:${HEX4}:){1,7}:|(?:${HEX4}:){1,6}:${HEX4}|:(?::${HEX4}){1,7}|::)(?![\\w:])`,
    ),
  },
];

const EMAIL_GLOBAL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/**
 * Teléfonos: con prefijo `+`, agrupados (`(591) 712-3456`, `71 234 567`) o 8 a 11 dígitos
 * corridos. Se acepta redactar de más (una fecha ISO no coincide con ninguno).
 */
const PHONE_GLOBAL =
  /\+\d[\d\s().-]{6,}\d|\(?\d{2,4}\)?[\s.-]\d{3,4}[\s.-]\d{3,4}\b|(?<![\d.])\d{8,11}(?![\d.])/g;

const MAX_DEPTH = 24;
/** Los secretos exactos más cortos que esto darían falsos positivos constantes. */
const MIN_SECRET_LENGTH = 8;

function scanString(
  value: string,
  where: string,
  knownSecrets: readonly string[],
  structured: boolean,
): ForbiddenDataError | null {
  for (const pattern of CREDENTIAL_PATTERNS) {
    if (pattern.regex.test(value)) return new ForbiddenDataError(`${pattern.name} en ${where}`);
  }
  for (const secret of knownSecrets) {
    if (
      secret.length >= MIN_SECRET_LENGTH &&
      (value.includes(secret) || value.includes(Buffer.from(secret, 'utf-8').toString('base64')))
    ) {
      return new ForbiddenDataError(`secreto de la configuración en ${where}`);
    }
  }
  if (structured) {
    for (const pattern of STRUCTURED_ONLY_PATTERNS) {
      if (pattern.regex.test(value)) return new ForbiddenDataError(`${pattern.name} en ${where}`);
    }
    // Un teléfono en un campo estructurado también bloquea (B1).
    PHONE_GLOBAL.lastIndex = 0;
    if (PHONE_GLOBAL.test(value)) {
      PHONE_GLOBAL.lastIndex = 0;
      return new ForbiddenDataError(`teléfono en ${where}`);
    }
  }
  return null;
}

function scanStructured(
  value: JsonValue,
  where: string,
  knownSecrets: readonly string[],
  depth: number,
): ForbiddenDataError | null {
  if (depth > MAX_DEPTH) return new ForbiddenDataError(`estructura demasiado profunda en ${where}`);
  if (typeof value === 'string') return scanString(value, where, knownSecrets, true);
  if (value === null || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const found = scanStructured(
        value[i] as JsonValue,
        `${where}[${i}]`,
        knownSecrets,
        depth + 1,
      );
      if (found) return found;
    }
    return null;
  }
  const record = value as { readonly [key: string]: JsonValue };
  for (const key of Object.keys(record)) {
    if (isForbiddenKey(key)) return new ForbiddenDataError(`clave prohibida "${key}" en ${where}`);
    const found = scanStructured(record[key], `${where}.${key}`, knownSecrets, depth + 1);
    if (found) return found;
  }
  return null;
}

/** Reemplaza emails y teléfonos del texto libre y cuenta cuántos. */
export function redactFreeText(text: string): { text: string; emails: number; phones: number } {
  let emails = 0;
  let phones = 0;
  const noEmails = text.replace(EMAIL_GLOBAL, () => {
    emails += 1;
    return '[email]';
  });
  const clean = noEmails.replace(PHONE_GLOBAL, () => {
    phones += 1;
    return '[teléfono]';
  });
  return { text: clean, emails, phones };
}

/**
 * Guardián de la frontera de datos (D13, capa 2): corre antes de la caché, del conteo y de la
 * reserva, sea cual sea el adaptador. Bloquea claves y valores prohibidos en los campos
 * estructurados, bloquea credenciales y secretos también en el texto libre, y en el texto libre
 * redacta emails y teléfonos. Devuelve el payload ya saneado, que es el que se hashea y se envía.
 */
export function assertLlmSafe(
  payload: LlmPayload,
  knownSecrets: readonly string[] = [],
): Result<SafePayload, ForbiddenDataError> {
  const structuredProblem = scanStructured(payload.structured, 'structured', knownSecrets, 0);
  if (structuredProblem) return fail(structuredProblem);

  const freeText: Record<string, string> = {};
  let emails = 0;
  let phones = 0;
  for (const key of Object.keys(payload.freeText)) {
    if (isForbiddenKey(key)) {
      return fail(new ForbiddenDataError(`clave prohibida "${key}" en freeText`));
    }
    const original = payload.freeText[key];
    const problem = scanString(original, `freeText.${key}`, knownSecrets, false);
    if (problem) return fail(problem);
    const redacted = redactFreeText(original);
    emails += redacted.emails;
    phones += redacted.phones;
    freeText[key] = redacted.text;
  }
  return ok({
    payload: { structured: payload.structured, freeText },
    redactions: { emails, phones },
  });
}
