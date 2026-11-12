/** Tope del texto que se guarda o se loguea de un fallo de integración (D16). */
export const MAX_REDACTED_LENGTH = 500;

const MARKER = '[Redacted]';

/** Patrones de credenciales conocidas; se aplican después de los valores exactos. */
const TOKEN_PATTERNS: readonly RegExp[] = [
  /github_pat_[A-Za-z0-9_]{10,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{10,}/g,
  /sk-ant-[A-Za-z0-9_-]{8,}/g,
];

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Reemplaza por `[Redacted]` los secretos conocidos (valor exacto y su forma en base64) y los
 * patrones de tokens habituales (`ghp_…`, `github_pat_…`, `sk-ant-…`, `Bearer …`, `token=…`),
 * y recorta a 500 caracteres. Pura: se usa antes de guardar o loguear cualquier texto que venga
 * de un tercero o de un conector (change `add-integrations-foundation`, D16).
 */
export function redactSecrets(text: string, knownSecrets: readonly string[] = []): string {
  let out = text;
  const needles = new Set<string>();
  for (const secret of knownSecrets) {
    if (secret.length === 0) continue;
    needles.add(secret);
    needles.add(Buffer.from(secret, 'utf-8').toString('base64'));
  }
  // Los más largos primero: un secreto que contiene a otro no debe quedar a medias.
  for (const needle of [...needles].sort((a, b) => b.length - a.length)) {
    out = out.replace(new RegExp(escapeRegExp(needle), 'g'), MARKER);
  }
  for (const pattern of TOKEN_PATTERNS) out = out.replace(pattern, MARKER);
  out = out.replace(/(\bBearer\s+)[A-Za-z0-9._~+/=-]+/gi, `$1${MARKER}`);
  out = out.replace(/(\btoken=)[^&\s"']*/gi, `$1${MARKER}`);
  return out.length > MAX_REDACTED_LENGTH ? out.slice(0, MAX_REDACTED_LENGTH) : out;
}
