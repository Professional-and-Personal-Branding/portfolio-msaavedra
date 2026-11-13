import { JobPosting, NewJobPosting } from '../entities/job-posting.entity';

export const JOB_POSTING_REPOSITORY = Symbol('JobPostingRepository');

export interface UpsertJobPostingResult {
  readonly posting: JobPosting;
  /** `true` si la fila era nueva (201); `false` si se actualizó una existente (200). */
  readonly created: boolean;
}

export interface JobPostingRepository {
  /** Una fila por `sourceKey`; reintenta una vez como actualización ante una carrera (P2002). */
  upsertBySourceKey(data: NewJobPosting): Promise<UpsertJobPostingResult>;
  /** Por `importedAt` descendente. */
  list(): Promise<JobPosting[]>;
  findById(id: string): Promise<JobPosting | null>;
  /** `false` si no existía. */
  delete(id: string): Promise<boolean>;
  /**
   * Borra `description` de las vacantes con `textPurgeAt <= now`, conservando metadatos y
   * términos (D13). Un único `UPDATE`; devuelve la cantidad de filas purgadas.
   */
  purgeExpiredText(now: Date): Promise<number>;
}
