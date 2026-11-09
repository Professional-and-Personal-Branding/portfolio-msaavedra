import { CvIssue, CvRuleContext, issue } from '../cv-issue';
import { CvSnapshot } from '../cv-snapshot';

/**
 * `experience.multiple-current` (info, D4 y D6): más de una experiencia visible marcada como
 * actual. Una issue por cada una, con `count`. Las ocultas no cuentan.
 */
export function currentRule(snapshot: CvSnapshot, _ctx: CvRuleContext): CvIssue[] {
  const current = snapshot.experiences.filter((e) => e.visible && e.current);
  if (current.length <= 1) return [];
  return current.map((e) =>
    issue('experience.multiple-current', 'experience', e.id, 'current', { count: current.length }),
  );
}
