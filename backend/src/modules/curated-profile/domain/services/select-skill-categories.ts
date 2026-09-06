import { SkillCategory } from '../../../skill/domain/entities/skill-category.entity';
import { selectByTags, SelectionCriteria } from './select-by-tags';

/**
 * Aplica la selección por tags/overrides a las skills de cada categoría y descarta
 * las categorías que quedan vacías. Conserva el orden de categorías y de skills.
 */
export function selectSkillCategories(
  categories: readonly SkillCategory[],
  criteria: SelectionCriteria,
): SkillCategory[] {
  return categories
    .map((category) => category.withSkills(selectByTags(category.skills, criteria)))
    .filter((category) => category.skills.length > 0);
}
