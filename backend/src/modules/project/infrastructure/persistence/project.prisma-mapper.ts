import type { Prisma, Project as ProjectRecord } from '@prisma/client';
import { toLocalizedText } from '../../../../shared/infrastructure/persistence/json.guards';
import { NewProjectProps, Project } from '../../domain/entities/project.entity';

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

/** Props de dominio → datos de escritura Prisma (Json para los bilingües). */
export function toProjectData(props: NewProjectProps): Prisma.ProjectUncheckedCreateInput {
  return {
    name: props.name,
    role: props.role,
    period: props.period,
    summary: props.summary,
    technologies: [...props.technologies],
    tags: [...props.tags],
    url: props.url,
    order: props.order,
    visible: props.visible,
  };
}
