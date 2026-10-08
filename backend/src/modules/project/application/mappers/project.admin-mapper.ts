import { Project } from '../../domain/entities/project.entity';
import { AdminProjectOutput } from '../dto/project.admin-output';

export function toAdminProjectOutput(p: Project): AdminProjectOutput {
  return {
    id: p.id,
    name: p.name,
    role: p.role,
    period: p.period,
    summary: p.summary,
    technologies: [...p.technologies],
    tags: [...p.tags],
    url: p.url,
    order: p.order,
    visible: p.visible,
  };
}
