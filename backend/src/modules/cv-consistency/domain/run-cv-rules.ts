import { CvIssue, CvRuleContext } from './cv-issue';
import { CvSnapshot } from './cv-snapshot';
import { certificationsRule } from './rules/certifications.rule';
import { currentRule } from './rules/current.rule';
import { curatedRule } from './rules/curated.rule';
import { datesRule } from './rules/dates.rule';
import { translationsRule } from './rules/translations.rule';
import { urlsRule } from './rules/urls.rule';
import { yearsRule } from './rules/years.rule';

export type CvRule = (snapshot: CvSnapshot, ctx: CvRuleContext) => CvIssue[];

/** Orden fijo: con el mismo contenido, dos corridas devuelven lo mismo (D1). */
export const CV_RULES: readonly CvRule[] = [
  yearsRule,
  datesRule,
  currentRule,
  translationsRule,
  urlsRule,
  certificationsRule,
  curatedRule,
];

/** Aplica todas las reglas (puras, sin efectos) y concatena sus hallazgos. */
export function runCvRules(snapshot: CvSnapshot, ctx: CvRuleContext): CvIssue[] {
  return CV_RULES.flatMap((rule) => rule(snapshot, ctx));
}
