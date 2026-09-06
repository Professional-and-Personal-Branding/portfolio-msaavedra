import { SkillCategory } from '../entities/skill-category.entity';

export const SKILL_CATEGORY_REPOSITORY = Symbol('SkillCategoryRepository');

/** Puerto de lectura de skills agrupadas por categoría (orden canónico: `order` asc). */
export interface SkillCategoryRepository {
  findAll(): Promise<SkillCategory[]>;
}
