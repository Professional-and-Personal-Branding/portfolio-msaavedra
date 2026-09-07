import { Locale, resolveLocale } from '../../../../shared/domain/i18n';
import { Project } from '../../domain/entities/project.entity';
import { ProjectOutput } from '../dto/project.output';

export function toProjectOutput(p: Project, locale: Locale): ProjectOutput {
  return {
    id: p.id,
    name: p.name,
    role: resolveLocale(p.role, locale),
    period: p.period,
    summary: resolveLocale(p.summary, locale),
    technologies: [...p.technologies],
    tags: [...p.tags],
    url: p.url,
    order: p.order,
  };
}
