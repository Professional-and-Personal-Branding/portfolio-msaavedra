import { CvEntityType, CvIssueCode, CvIssueParams, CvSeverity } from '../domain/cv-issue';

/** Un hallazgo con el mensaje y la etiqueta ya resueltos en el idioma pedido (D8). */
export interface CvIssueOutput {
  readonly code: CvIssueCode;
  readonly severity: CvSeverity;
  readonly entityType: CvEntityType;
  readonly entityId: string;
  /** Nombre legible del ítem (empresa, título, slug…), en el idioma pedido. */
  readonly entityLabel: string;
  readonly field: string | null;
  readonly message: string;
  readonly params: CvIssueParams;
}

export interface CvExperienceSummary {
  /** `Profile.yearsOfExperience`, tal como se cargó. */
  readonly declaredYears: number;
  /** Meses fusionados de todas las experiencias hasta `asOf`. */
  readonly derivedMonths: number;
}

/** Respuesta de `GET /api/admin/consistency` y salida `--format json` de `cv:lint` (D10 y D13). */
export interface CvConsistencyReport {
  /** Mes de referencia `YYYY-MM` (UTC). */
  readonly asOf: string;
  /** `null` si todavía no hay perfil base. */
  readonly experience: CvExperienceSummary | null;
  readonly summary: Readonly<Record<CvSeverity, number>>;
  readonly issues: readonly CvIssueOutput[];
}
