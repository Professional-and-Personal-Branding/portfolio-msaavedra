import type { Prisma } from '@prisma/client';
import { toLocalizedText } from '../../../../shared/infrastructure/persistence/json.guards';
import { SkillCategory } from '../../domain/entities/skill-category.entity';
import { Skill } from '../../domain/entities/skill.entity';

export type SkillCategoryRecord = Prisma.SkillCategoryGetPayload<{ include: { skills: true } }>;

export function toSkillCategoryEntity(record: SkillCategoryRecord): SkillCategory {
  return SkillCategory.create({
    id: record.id,
    name: toLocalizedText(record.name, 'SkillCategory.name'),
    order: record.order,
    skills: record.skills.map((s) =>
      Skill.create({ id: s.id, name: s.name, tags: s.tags, order: s.order }),
    ),
  });
}
