import {
  CERTIFICATION_DATE_REGEX,
  YEAR_REGEX,
} from '../../../education/domain/services/validate-certification';
import {
  EDUCATION_DATE_REGEX,
  isAfter,
} from '../../../education/domain/services/validate-education';
import { YEAR_MONTH_REGEX } from '../../../experience/domain/services/validate-experience';
import { CvIssue, CvRuleContext, issue } from '../cv-issue';
import { CvSnapshot } from '../cv-snapshot';

const EXPECTED_YEAR_MONTH = 'AAAA-MM';
const EXPECTED_YEAR_OR_MONTH = 'AAAA-MM o AAAA';
const EXPECTED_YEAR = 'AAAA';

/**
 * Reglas de fechas (D4), todas `error` y sobre ítems visibles u ocultos (D6): un dato roto lo
 * es aunque esté oculto. Reusan los regex de los validadores de escritura. Ninguna depende de
 * `asOf` (D11).
 */
export function datesRule(snapshot: CvSnapshot, _ctx: CvRuleContext): CvIssue[] {
  const found: CvIssue[] = [];
  const invalid = (
    entityType: 'experience' | 'education' | 'certification',
    id: string,
    field: string,
    value: string,
    expected: string,
  ): void => {
    found.push(issue('date.invalid-format', entityType, id, field, { expected, value }));
  };

  for (const e of snapshot.experiences) {
    const startOk = YEAR_MONTH_REGEX.test(e.startDate);
    const endOk = e.endDate === null || YEAR_MONTH_REGEX.test(e.endDate);
    if (!startOk) invalid('experience', e.id, 'startDate', e.startDate, EXPECTED_YEAR_MONTH);
    if (!endOk) invalid('experience', e.id, 'endDate', e.endDate, EXPECTED_YEAR_MONTH);
    if (e.current && e.endDate !== null) {
      found.push(issue('date.ongoing-with-end', 'experience', e.id, 'endDate', { end: e.endDate }));
    }
    if (startOk && endOk && e.endDate !== null && e.startDate > e.endDate) {
      found.push(
        issue('date.end-before-start', 'experience', e.id, 'endDate', {
          start: e.startDate,
          end: e.endDate,
        }),
      );
    }
  }

  for (const e of snapshot.education) {
    const startOk = EDUCATION_DATE_REGEX.test(e.startDate);
    const endOk = e.endDate === null || EDUCATION_DATE_REGEX.test(e.endDate);
    if (!startOk) invalid('education', e.id, 'startDate', e.startDate, EXPECTED_YEAR_OR_MONTH);
    if (!endOk) invalid('education', e.id, 'endDate', e.endDate, EXPECTED_YEAR_OR_MONTH);
    if (e.inProgress && e.endDate !== null) {
      found.push(issue('date.ongoing-with-end', 'education', e.id, 'endDate', { end: e.endDate }));
    }
    if (startOk && endOk && e.endDate !== null && isAfter(e.startDate, e.endDate)) {
      found.push(
        issue('date.end-before-start', 'education', e.id, 'endDate', {
          start: e.startDate,
          end: e.endDate,
        }),
      );
    }
  }

  for (const c of snapshot.certifications) {
    if (c.year !== null && !YEAR_REGEX.test(c.year)) {
      invalid('certification', c.id, 'year', c.year, EXPECTED_YEAR);
    }
    if (c.expiresAt !== null && !CERTIFICATION_DATE_REGEX.test(c.expiresAt)) {
      invalid('certification', c.id, 'expiresAt', c.expiresAt, EXPECTED_YEAR_OR_MONTH);
    }
  }

  return found;
}
