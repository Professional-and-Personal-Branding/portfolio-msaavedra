import { NewSkillCategoryProps, SkillCategory } from '../entities/skill-category.entity';
import { NewSkillProps, Skill } from '../entities/skill.entity';

export const SKILL_CATEGORY_REPOSITORY = Symbol('SkillCategoryRepository');

/** Puerto de skills agrupadas por categoría: lectura (Fase 2) + escritura del backoffice (Fase 3). */
export interface SkillCategoryRepository {
  /** Categorías con sus skills (orden canónico: `order` asc en ambos niveles). */
  findAll(): Promise<SkillCategory[]>;
  findById(id: string): Promise<SkillCategory | null>;
  create(props: NewSkillCategoryProps): Promise<SkillCategory>;
  /** Persiste nombre/orden de la categoría; null si no existe. */
  update(category: SkillCategory): Promise<SkillCategory | null>;
  /** Borra la categoría y sus skills; true si existía. */
  delete(id: string): Promise<boolean>;

  findSkillById(id: string): Promise<Skill | null>;
  /** La categoría debe existir (lo verifica el caso de uso). */
  createSkill(categoryId: string, props: NewSkillProps): Promise<Skill>;
  /** Persiste el estado completo (incluida la categoría destino); null si no existe. */
  updateSkill(skill: Skill): Promise<Skill | null>;
  deleteSkill(id: string): Promise<boolean>;
}
