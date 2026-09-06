import type { Experience as ExperienceRecord } from '@prisma/client';
import {
  toLocalizedList,
  toLocalizedText,
} from '../../../../shared/infrastructure/persistence/json.guards';
import { Experience } from '../../domain/entities/experience.entity';

export type { ExperienceRecord };

/** Traduce el registro Prisma (persistencia) a la entidad de dominio. */
export function toExperienceEntity(record: ExperienceRecord): Experience {
  return Experience.create({
    id: record.id,
    company: record.company,
    role: toLocalizedText(record.role, 'Experience.role'),
    startDate: record.startDate,
    endDate: record.endDate,
    current: record.current,
    location: record.location,
    summary: toLocalizedText(record.summary, 'Experience.summary'),
    highlights: toLocalizedList(record.highlights, 'Experience.highlights'),
    technologies: record.technologies,
    tags: record.tags,
    sector: record.sector,
    order: record.order,
    visible: record.visible,
  });
}
