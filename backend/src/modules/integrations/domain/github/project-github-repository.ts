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
  typeof value === 'string' && value.trim() !== '' ? value : null;

const asBoolean = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);

const asCount = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;

function asIsoDate(value: unknown): string | null {
  const text = asString(value);
  return text !== null && Number.isFinite(Date.parse(text)) ? text : null;
}

function asTopics(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const topics = value
    .filter((topic): topic is string => typeof topic === 'string' && topic.trim() !== '')
    .map((topic) => topic.trim().toLowerCase());
  return [...new Set(topics)].slice(0, MAX_TOPICS);
}

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
    language: asString(source.language),
    topics: asTopics(source.topics),
    pushed_at: asIsoDate(source.pushed_at),
    description: description === null ? null : description.slice(0, MAX_DESCRIPTION_LENGTH),
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
    .slice(0, MAX_LANGUAGES);
  return Object.fromEntries(entries);
}
