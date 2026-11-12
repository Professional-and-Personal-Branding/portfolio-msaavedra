export const JOB_POSTING_READER = Symbol('JobPostingReader');

/** Lo único que el borrador de un perfil curado necesita de una vacante (D1). */
export interface JobPostingDraftSource {
  readonly id: string;
  readonly title: string;
  readonly company: string | null;
  readonly language: string | null;
}

/**
 * Puerto de lectura que `job-posting` define y exporta para `curated-profile` (D1), igual que
 * `AnalyticsModule` exporta `PROFILE_VIEW_REPOSITORY`. `curated-profile` no importa nada más de
 * este módulo (D19).
 */
export interface JobPostingReader {
  findDraftSource(id: string): Promise<JobPostingDraftSource | null>;
}
