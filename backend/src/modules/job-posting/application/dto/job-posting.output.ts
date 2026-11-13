import { JobPostingSourceKind, WorkplaceType } from '../../domain/entities/job-posting.entity';

/** Vacante para el panel. `description` es `null` tras la purga (D13); el resto se conserva. */
export interface JobPostingOutput {
  id: string;
  source: JobPostingSourceKind;
  sourceUrl: string | null;
  applyUrl: string | null;
  title: string;
  company: string | null;
  location: string | null;
  workplaceType: WorkplaceType | null;
  employmentType: string | null;
  compensation: string | null;
  language: string | null;
  postedAt: string | null;
  description: string | null;
  descriptionTruncated: boolean;
  detectedTerms: string[];
  importedAt: string;
  /** Cuándo se borra (o se borró) el texto. */
  textPurgeAt: string;
  /** `true` si el texto ya se borró. */
  textPurged: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CoveredTagOutput {
  tag: string;
  /** Ítems visibles de tus datos que llevan el tag. */
  evidence: number;
}

export interface TagCoverageOutput {
  covered: CoveredTagOutput[];
  uncovered: string[];
  detectedCount: number;
  coveredCount: number;
  /** `null` si no se detectó ningún término. */
  ratio: number | null;
}

/** Lo único que devuelve la sugerencia (D12): se calcula contra el vocabulario vigente. */
export interface JobPostingSuggestionOutput {
  coverage: TagCoverageOutput;
  suggestedFilterTags: string[];
  suggestedTitle: string;
  suggestedSlugBase: string;
}

export interface ImportJobPostingOutput {
  posting: JobPostingOutput;
  /** `true` si era nueva (201); `false` si se actualizó una existente (200). */
  created: boolean;
}
