/**
 * Hallazgo de la revisión de consistencia del CV (D4 y D8 de `add-cv-consistency-rules`).
 * El dominio no tiene textos: el mensaje lo resuelve la capa de aplicación a partir del
 * código y de `params`.
 */

/** Catálogo cerrado y estable de reglas; agregar un código es un cambio de spec. */
export const CV_ISSUE_CODES = [
  'profile.years-mismatch',
  'date.invalid-format',
  'date.end-before-start',
  'date.ongoing-with-end',
  'experience.multiple-current',
  'i18n.missing-translation',
  'i18n.highlights-count-mismatch',
  'url.invalid',
  'url.not-https',
  'certification.expired',
  'curated.orphan-reference',
  'curated.conflicting-reference',
  'curated.unmatched-filter-tag',
  'curated.no-experiences',
] as const;
export type CvIssueCode = (typeof CV_ISSUE_CODES)[number];

/**
 * `error`: el dato viola una regla que la API del panel rechazaría, o rompe el render.
 * `warning`: probablemente es un descuido y lo ve un reclutador.
 * `info`: conviene mirarlo, pero suele ser legítimo.
 */
export const CV_SEVERITIES = ['error', 'warning', 'info'] as const;
export type CvSeverity = (typeof CV_SEVERITIES)[number];

/** En el orden en que se ordenan y agrupan los hallazgos. */
export const CV_ENTITY_TYPES = [
  'profile',
  'language',
  'experience',
  'skillCategory',
  'skill',
  'education',
  'certification',
  'project',
  'repository',
  'socialLink',
  'curatedProfile',
] as const;
export type CvEntityType = (typeof CV_ENTITY_TYPES)[number];

export type CvIssueParams = Readonly<Record<string, string | number>>;

export interface CvIssue {
  readonly code: CvIssueCode;
  readonly severity: CvSeverity;
  readonly entityType: CvEntityType;
  /** Id exacto: cuid en la base, la clave del seed en `cv:lint`. */
  readonly entityId: string;
  readonly field: string | null;
  readonly params: CvIssueParams;
}

/** Severidad fija de cada código (D4). */
export const CV_ISSUE_SEVERITY: Readonly<Record<CvIssueCode, CvSeverity>> = {
  'profile.years-mismatch': 'warning',
  'date.invalid-format': 'error',
  'date.end-before-start': 'error',
  'date.ongoing-with-end': 'error',
  'experience.multiple-current': 'info',
  'i18n.missing-translation': 'warning',
  'i18n.highlights-count-mismatch': 'warning',
  'url.invalid': 'error',
  'url.not-https': 'warning',
  'certification.expired': 'info',
  'curated.orphan-reference': 'warning',
  'curated.conflicting-reference': 'info',
  'curated.unmatched-filter-tag': 'warning',
  'curated.no-experiences': 'warning',
};

/** Mes de referencia `YYYY-MM`. */
export interface CvRuleContext {
  readonly asOf: string;
}

/** Arma un hallazgo con la severidad del catálogo. */
export function issue(
  code: CvIssueCode,
  entityType: CvEntityType,
  entityId: string,
  field: string | null,
  params: CvIssueParams = {},
): CvIssue {
  return { code, severity: CV_ISSUE_SEVERITY[code], entityType, entityId, field, params };
}
