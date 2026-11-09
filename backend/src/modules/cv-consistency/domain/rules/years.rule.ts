import { computeYearsOfExperience } from '../../../profile/domain/services/compute-years-of-experience';
import { CvIssue, CvRuleContext, issue } from '../cv-issue';
import { CvSnapshot } from '../cv-snapshot';

/**
 * `profile.years-mismatch` (D3): `Profile.yearsOfExperience` contra los meses fusionados de
 * TODAS las experiencias, ocultas incluidas. Es consistente dentro de `[floor, ceil]` de los
 * años derivados. Sin experiencias no hay contra qué contrastar.
 */
export function yearsRule(snapshot: CvSnapshot, ctx: CvRuleContext): CvIssue[] {
  const { profile, experiences } = snapshot;
  if (profile === null || experiences.length === 0) return [];
  const { months, years, remainderMonths } = computeYearsOfExperience(experiences, ctx.asOf);
  const declared = profile.yearsOfExperience;
  if (declared >= Math.floor(months / 12) && declared <= Math.ceil(months / 12)) return [];
  return [
    issue('profile.years-mismatch', 'profile', profile.id, 'yearsOfExperience', {
      declared,
      months,
      years,
      remainderMonths,
    }),
  ];
}
