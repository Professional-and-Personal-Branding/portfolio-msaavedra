/**
 * Proyecciones con lista blanca de las respuestas de GitHub (change `add-github-code-evidence`, D4).
 * El cuerpo que se guarda en `ExternalSnapshot` es SOLO esto: así un cambio ajeno (`watchers`,
 * `updated_at`, `open_issues`) no cuenta como cambio y no se persisten datos de terceros que
 * nadie usa. Un campo con tipo inesperado pasa a `null` en lugar de hacer fallar la corrida.
 */
export const MAX_TOPICS = 20;
export const MAX_LANGUAGES = 20;
export const MAX_DESCRIPTION_LENGTH = 350;
export const MAX_PRIMARY_LANGUAGE_LENGTH = 40;
/** Largo máximo (en code points) de cada topic y de cada nombre de lenguaje. */
export const MAX_TERM_LENGTH = 50;
/** Tope de un conteo que va a una columna INTEGER de Postgres. */
export const MAX_INT32 = 2_147_483_647;

/**
 * Todo string remoto que se guarda pasa por acá: los surrogates sueltos y el NUL los rechaza
 * Postgres (JSONB y texto), y un solo valor así dejaría el trabajo en DEAD (revisión de seguridad M1).
 */
export function wellFormed(text: string): string {
  return text
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD')
    .split('\u0000')
    .join('');
}

/** Corta por code points (nunca deja medio emoji) después de sanear. */
export function truncateCodePoints(text: string, max: number): string {
  return Array.from(wellFormed(text)).slice(0, max).join('');
}

export interface GithubRepositoryProjection {
  readonly full_name: string | null;
  readonly private: boolean | null;
  readonly fork: boolean | null;
  readonly archived: boolean | null;
  readonly stargazers_count: number | null;
  readonly language: string | null;
  readonly topics: readonly string[];
  readonly pushed_at: string | null;
  readonly description: string | null;
  readonly html_url: string | null;
}

/** `{ lenguaje: bytes }`, hasta 20 entradas con bytes enteros ≥ 0. */
export type GithubLanguagesProjection = Readonly<Record<string, number>>;

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asString = (value: unknown): string | null =>
  typeof value === 'string' && wellFormed(value).trim() !== '' ? wellFormed(value) : null;

const asBoolean = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);

const asCount = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? Math.min(value, MAX_INT32)
    : null;

function asIsoDate(value: unknown): string | null {
  const text = asString(value);
  return text !== null && Number.isFinite(Date.parse(text)) ? text : null;
}

function asTopics(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const topics = value
    .filter((topic): topic is string => typeof topic === 'string' && topic.trim() !== '')
    .map((topic) => truncateCodePoints(topic.trim().toLowerCase(), MAX_TERM_LENGTH));
  return [...new Set(topics)].slice(0, MAX_TOPICS);
}

const truncateOrNull = (text: string | null, max: number): string | null =>
  text === null ? null : truncateCodePoints(text, max);

/** Respuesta de `GET /repos/{owner}/{repo}` → solo lo que se usa. */
export function projectGithubRepository(body: unknown): GithubRepositoryProjection {
  const source = asRecord(body);
  const description = asString(source.description);
  return {
    full_name: asString(source.full_name),
    private: asBoolean(source.private),
    fork: asBoolean(source.fork),
    archived: asBoolean(source.archived),
    stargazers_count: asCount(source.stargazers_count),
    language: truncateOrNull(asString(source.language), MAX_PRIMARY_LANGUAGE_LENGTH),
    topics: asTopics(source.topics),
    pushed_at: asIsoDate(source.pushed_at),
    description:
      description === null ? null : truncateCodePoints(description, MAX_DESCRIPTION_LENGTH),
    html_url: asString(source.html_url),
  };
}

/** Respuesta de `GET /repos/{owner}/{repo}/languages` → hasta 20 lenguajes con bytes enteros ≥ 0. */
export function projectGithubLanguages(body: unknown): GithubLanguagesProjection {
  const entries = Object.entries(asRecord(body))
    .filter((entry): entry is [string, number] => asCount(entry[1]) !== null)
    .sort(([nameA, bytesA], [nameB, bytesB]) =>
      bytesB !== bytesA ? bytesB - bytesA : nameA < nameB ? -1 : nameA > nameB ? 1 : 0,
    )
    .slice(0, MAX_LANGUAGES)
    .map(([name, bytes]): [string, number] => [
      truncateCodePoints(name, MAX_TERM_LENGTH),
      Math.min(bytes, MAX_INT32),
    ])
    .filter(([name]) => name !== '');
  return Object.fromEntries(entries);
}
