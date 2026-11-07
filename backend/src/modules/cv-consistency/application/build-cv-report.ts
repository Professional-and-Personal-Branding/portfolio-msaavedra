import { Locale } from '../../../shared/domain/i18n';
import { computeYearsOfExperience } from '../../profile/domain/services/compute-years-of-experience';
import { CV_ENTITY_TYPES, CV_SEVERITIES, CvIssue, CvSeverity } from '../domain/cv-issue';
import { CvSnapshot } from '../domain/cv-snapshot';
import { runCvRules } from '../domain/run-cv-rules';
import { cvEntityLabel, cvIssueMessage } from './cv-issue-messages';
import { CvConsistencyReport, CvIssueOutput } from './cv-consistency.output';

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Orden de D10: severidad, tipo de entidad (el de D8), etiqueta y código. Determinista. */
function compareOutputs(a: CvIssueOutput, b: CvIssueOutput): number {
  return (
    CV_SEVERITIES.indexOf(a.severity) - CV_SEVERITIES.indexOf(b.severity) ||
    CV_ENTITY_TYPES.indexOf(a.entityType) - CV_ENTITY_TYPES.indexOf(b.entityType) ||
    compare(a.entityLabel, b.entityLabel) ||
    compare(a.code, b.code) ||
    compare(a.entityId, b.entityId) ||
    compare(a.field ?? '', b.field ?? '') ||
    compare(JSON.stringify(a.params), JSON.stringify(b.params))
  );
}

/**
 * Reporte de consistencia a partir de una instantánea (D9, D10 y D13): corre las reglas, resuelve
 * mensaje y etiqueta en el idioma pedido y ordena. Función pura: la comparten el caso de uso
 * (instantánea de la base) y `cv:lint` (instantánea del archivo del seed).
 */
export function buildCvReport(
  snapshot: CvSnapshot,
  asOf: string,
  locale: Locale,
): CvConsistencyReport {
  const found: CvIssue[] = runCvRules(snapshot, { asOf });
  const issues: CvIssueOutput[] = found
    .map((issue) => ({
      code: issue.code,
      severity: issue.severity,
      entityType: issue.entityType,
      entityId: issue.entityId,
      entityLabel: cvEntityLabel(snapshot, issue, locale),
      field: issue.field,
      message: cvIssueMessage(issue, locale),
      params: issue.params,
    }))
    .sort(compareOutputs);

  const summary: Record<CvSeverity, number> = { error: 0, warning: 0, info: 0 };
  for (const issue of issues) summary[issue.severity] += 1;

  const experience = snapshot.profile
    ? {
        declaredYears: snapshot.profile.yearsOfExperience,
        derivedMonths: computeYearsOfExperience(snapshot.experiences, asOf).months,
      }
    : null;

  return { asOf, experience, summary, issues };
}
