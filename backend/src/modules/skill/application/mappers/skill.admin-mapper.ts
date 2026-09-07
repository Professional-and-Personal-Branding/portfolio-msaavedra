import { SkillCategory } from '../../domain/entities/skill-category.entity';
import { Skill } from '../../domain/entities/skill.entity';
import { AdminSkillCategoryOutput, AdminSkillOutput } from '../dto/skill.admin-output';

export function toAdminSkillOutput(skill: Skill, categoryId?: string): AdminSkillOutput {
  return {
    id: skill.id,
    name: skill.name,
    tags: [...skill.tags],
    order: skill.order,
    categoryId: categoryId ?? skill.categoryId ?? null,
  };
}

export function toAdminSkillCategoryOutput(category: SkillCategory): AdminSkillCategoryOutput {
  return {
    id: category.id,
    name: category.name,
    order: category.order,
    skills: category.skills.map((s) => toAdminSkillOutput(s, category.id)),
  };
}
