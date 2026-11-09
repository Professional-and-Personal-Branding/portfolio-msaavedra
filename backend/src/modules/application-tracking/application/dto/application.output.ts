import { ApplicationStatus } from '../../domain/application-status';

/** Aperturas del enlace de una postulación: solo visitas `HUMAN`, en toda la historia (D8). */
export interface ApplicationShareLinkOutput {
  id: string;
  label: string;
  code: string;
  revoked: boolean;
  opens: number;
  /** ISO 8601 de la primera apertura de una persona, o null. */
  firstOpenedAt: string | null;
  /** ISO 8601 de la última apertura de una persona, o null. */
  lastOpenedAt: string | null;
}

/** Postulación tal como la ve el panel (D2, D6, D8). */
export interface ApplicationOutput {
  id: string;
  company: string;
  role: string;
  jobUrl: string | null;
  portal: string | null;
  notes: string | null;
  status: ApplicationStatus;
  /** `AAAA-MM-DD`; nula con `DRAFT`. */
  appliedAt: string | null;
  /** ISO 8601. */
  statusChangedAt: string;
  curatedProfileId: string | null;
  profileSlug: string | null;
  shareLink: ApplicationShareLinkOutput | null;
  /** Estados a los que puede pasar (D6): el panel arma el selector con estos. */
  nextStatuses: ApplicationStatus[];
  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601. */
  updatedAt: string;
}

/** Conteo por estado (los siete, con ceros) y procesos en curso (D9). */
export interface ApplicationSummaryOutput {
  byStatus: Record<ApplicationStatus, number>;
  active: number;
}
