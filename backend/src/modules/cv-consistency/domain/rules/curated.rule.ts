import {
  matchesAnyTag,
  selectByTags,
} from '../../../curated-profile/domain/services/select-by-tags';
import { CvIssue, CvRuleContext, issue } from '../cv-issue';
import { CvSnapshot } from '../cv-snapshot';

/**
 * Reglas de los perfiles curados (D4 y D6). Se revisan todos los no archivados, cualquiera sea
 * su visibilidad. Reusan `selectByTags` y `matchesAnyTag` sin normalizar: si el sitio no lo
 * seleccionaría, el linter tampoco.
 *
 * - `orphan-reference`: contra TODOS los ítems (un id de un ítem oculto no es huérfano).
 * - `unmatched-filter-tag` y `no-experiences`: contra los ítems visibles, como la selección pública.
 */
export function curatedRule(snapshot: CvSnapshot, _ctx: CvRuleContext): CvIssue[] {
  const knownIds = new Set<string>([
    ...snapshot.experiences.map((e) => e.id),
    ...snapshot.skillCategories.flatMap((c) => c.skills.map((s) => s.id)),
    ...snapshot.projects.map((p) => p.id),
  ]);
  const visibleExperiences = snapshot.experiences.filter((e) => e.visible);
  const visibleTagSets: ReadonlyArray<readonly string[]> = [
    ...visibleExperiences.map((e) => e.tags),
    ...snapshot.skillCategories.flatMap((c) => c.skills.map((s) => s.tags)),
    ...snapshot.projects.filter((p) => p.visible).map((p) => p.tags),
  ];

  const found: CvIssue[] = [];
  for (const curated of snapshot.curatedProfiles) {
    if (curated.archived) continue;
    const { id } = curated;

    for (const list of ['includeIds', 'excludeIds'] as const) {
      for (const refId of curated[list]) {
        if (!knownIds.has(refId)) {
          found.push(
            issue('curated.orphan-reference', 'curatedProfile', id, list, { list, id: refId }),
          );
        }
      }
    }

    const excluded = new Set(curated.excludeIds);
    for (const refId of new Set(curated.includeIds)) {
      if (excluded.has(refId)) {
        found.push(
          issue('curated.conflicting-reference', 'curatedProfile', id, 'includeIds', { id: refId }),
        );
      }
    }

    for (const tag of curated.filterTags) {
      if (!visibleTagSets.some((tags) => matchesAnyTag(tags, [tag]))) {
        found.push(
          issue('curated.unmatched-filter-tag', 'curatedProfile', id, 'filterTags', { tag }),
        );
      }
    }

    if (selectByTags(visibleExperiences, curated).length === 0) {
      found.push(issue('curated.no-experiences', 'curatedProfile', id, null));
    }
  }
  return found;
}
