import type { Prisma, Skill as SkillRecord } from '@prisma/client';
import { toLocalizedText } from '../../../../shared/infrastructure/persistence/json.guards';
import { SkillCategory } from '../../domain/entities/skill-category.entity';
import { Skill } from '../../domain/entities/skill.entity';

export type SkillCategoryRecord = Prisma.SkillCategoryGetPayload<{ include: { skills: true } }>;
export type { SkillRecord };

export function toSkillEntity(record: SkillRecord): Skill {
  return Skill.create({
    id: record.id,
    name: record.name,
    tags: record.tags,
    order: record.order,
    categoryId: record.categoryId,
  });
}

export function toSkillCategoryEntity(record: SkillCategoryRecord): SkillCategory {
  return SkillCategory.create({
    id: record.id,
    name: toLocalizedText(record.name, 'SkillCategory.name'),
    order: record.order,
    skills: record.skills.map(toSkillEntity),
  });
}
