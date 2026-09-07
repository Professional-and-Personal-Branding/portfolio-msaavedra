import { Experience } from '../../domain/entities/experience.entity';
import { AdminExperienceOutput } from '../dto/experience.admin-output';

export function toAdminExperienceOutput(e: Experience): AdminExperienceOutput {
  return {
    id: e.id,
    company: e.company,
    role: e.role,
    startDate: e.startDate,
    endDate: e.endDate,
    current: e.current,
    location: e.location,
    summary: e.summary,
    highlights: e.highlights,
    technologies: [...e.technologies],
    tags: [...e.tags],
    sector: [...e.sector],
    order: e.order,
    visible: e.visible,
    createdAt: e.createdAt?.toISOString() ?? null,
    updatedAt: e.updatedAt?.toISOString() ?? null,
  };
}
