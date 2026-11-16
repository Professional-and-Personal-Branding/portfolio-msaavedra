/**
 * Lo verificado contra GitHub para un repositorio destacado (change `add-github-code-evidence`,
 * D8). Lo escribe SOLO el conector `github` (módulo `integrations`); este módulo la lee y la
 * presenta. Es un value object plano: no hay reglas de escritura acá.
 */
export const REPOSITORY_EVIDENCE_STATUSES = ['OK', 'NOT_FOUND', 'INACCESSIBLE', 'PRIVATE'] as const;
export type RepositoryEvidenceStatus = (typeof REPOSITORY_EVIDENCE_STATUSES)[number];

export interface RepositoryEvidence {
  /** `owner/repo` en minúsculas, tal como se pidió en la última sincronización. */
  readonly repoKey: string;
  readonly status: RepositoryEvidenceStatus;
  readonly stars: number | null;
  readonly primaryLanguage: string | null;
  /** `{ lenguaje: bytes }`, hasta 20; `null` si nunca se pidieron. */
  readonly languages: Readonly<Record<string, number>> | null;
  readonly topics: readonly string[];
  readonly pushedAt: Date | null;
  readonly archived: boolean;
  readonly isFork: boolean;
  /** `full_name` si GitHub movió o renombró el repositorio. */
  readonly movedTo: string | null;
  /** Solo para el panel: referencia al curar la descripción. */
  readonly githubDescription: string | null;
  /** Última vez que GitHub respondió por este repositorio (200, 304, 404…). */
  readonly verifiedAt: Date;
  /** Última vez que cambió el contenido. */
  readonly changedAt: Date;
}

/** Evidencia sin los dos sellos de tiempo: lo que se compara para saber si «cambió». */
export type RepositoryEvidenceContent = Omit<RepositoryEvidence, 'verifiedAt' | 'changedAt'>;

/** ¿Dos evidencias tienen el mismo contenido (ignora `verifiedAt` y `changedAt`)? */
export function sameEvidenceContent(
  a: RepositoryEvidenceContent,
  b: RepositoryEvidenceContent,
): boolean {
  return (
    a.repoKey === b.repoKey &&
    a.status === b.status &&
    a.stars === b.stars &&
    a.primaryLanguage === b.primaryLanguage &&
    a.archived === b.archived &&
    a.isFork === b.isFork &&
    a.movedTo === b.movedTo &&
    a.githubDescription === b.githubDescription &&
    (a.pushedAt?.getTime() ?? null) === (b.pushedAt?.getTime() ?? null) &&
    a.topics.length === b.topics.length &&
    a.topics.every((topic, index) => topic === b.topics[index]) &&
    sameLanguages(a.languages, b.languages)
  );
}

function sameLanguages(
  a: Readonly<Record<string, number>> | null,
  b: Readonly<Record<string, number>> | null,
): boolean {
  if (a === null || b === null) return a === b;
  const keysA = Object.keys(a);
  return keysA.length === Object.keys(b).length && keysA.every((key) => a[key] === b[key]);
}
