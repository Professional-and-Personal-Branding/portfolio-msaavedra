/** Fuente de una vacante importada (D14). */
export const JOB_POSTING_SOURCES = ['GREENHOUSE', 'LEVER', 'ASHBY', 'JSON_LD', 'PASTED'] as const;
export type JobPostingSourceKind = (typeof JOB_POSTING_SOURCES)[number];

export const WORKPLACE_TYPES = ['REMOTE', 'HYBRID', 'ONSITE'] as const;
export type WorkplaceType = (typeof WORKPLACE_TYPES)[number];

/** Tope de la descripción guardada (D13); más largo se corta y se marca `descriptionTruncated`. */
export const MAX_DESCRIPTION_LENGTH = 20_000;

/** Días que se conserva el texto de la vacante (P5 = B, D13). */
export const TEXT_RETENTION_DAYS = 90;

/**
 * Lo que una fuente (ATS, JSON-LD o texto pegado) devuelve ya normalizado, antes de detectar
 * términos y de guardarlo. Textos planos, no bilingües: es un dato del panel (docs/I18N.md).
 */
export interface NormalizedPosting {
  readonly source: JobPostingSourceKind;
  readonly sourceKey: string;
  readonly sourceUrl: string | null;
  /** Solo https; si no, nulo. */
  readonly applyUrl: string | null;
  readonly title: string;
  readonly company: string | null;
  readonly location: string | null;
  readonly workplaceType: WorkplaceType | null;
  readonly employmentType: string | null;
  readonly compensation: string | null;
  readonly language: string | null;
  readonly postedAt: Date | null;
  /** Texto plano sin etiquetas; el caso de uso lo corta a `MAX_DESCRIPTION_LENGTH`. */
  readonly description: string;
}

/** Lo que se escribe: la vacante ya con términos detectados y fechas de retención. */
export interface NewJobPosting extends Omit<NormalizedPosting, 'description'> {
  readonly description: string | null;
  readonly descriptionTruncated: boolean;
  readonly detectedTerms: readonly string[];
  readonly importedAt: Date;
  readonly textPurgeAt: Date;
}

export interface JobPosting extends NewJobPosting {
  readonly id: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
