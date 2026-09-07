import type { Experience as ExperienceRecord, Prisma } from '@prisma/client';
import {
  toLocalizedList,
  toLocalizedText,
} from '../../../../shared/infrastructure/persistence/json.guards';
import { Experience, NewExperienceProps } from '../../domain/entities/experience.entity';

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
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

/** Traduce props de dominio a datos de escritura Prisma (Json para bilingües). */
export function toExperienceData(props: NewExperienceProps): Prisma.ExperienceUncheckedCreateInput {
  return {
    company: props.company,
    role: props.role,
    startDate: props.startDate,
    endDate: props.endDate,
    current: props.current,
    location: props.location,
    summary: props.summary,
    highlights: props.highlights,
    technologies: [...props.technologies],
    tags: [...props.tags],
    sector: [...props.sector],
    order: props.order,
    visible: props.visible,
  };
}
