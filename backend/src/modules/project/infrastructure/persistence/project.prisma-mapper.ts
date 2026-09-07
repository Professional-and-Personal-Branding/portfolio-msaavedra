import type { Project as ProjectRecord } from '@prisma/client';
import { toLocalizedText } from '../../../../shared/infrastructure/persistence/json.guards';
import { Project } from '../../domain/entities/project.entity';

export type { ProjectRecord };

export function toProjectEntity(r: ProjectRecord): Project {
  return Project.create({
    id: r.id,
    name: r.name,
    role: toLocalizedText(r.role, 'Project.role'),
    period: r.period,
    summary: toLocalizedText(r.summary, 'Project.summary'),
    technologies: r.technologies,
    tags: r.tags,
    url: r.url,
    order: r.order,
    visible: r.visible,
  });
}
