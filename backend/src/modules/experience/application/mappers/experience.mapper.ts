import { Locale, resolveLocale, resolveLocaleList } from '../../../../shared/domain/i18n';
import { Experience } from '../../domain/entities/experience.entity';
import { ExperienceOutput } from '../dto/experience.output';

/** Proyecta la experiencia bilingüe al idioma pedido. */
export function toExperienceOutput(experience: Experience, locale: Locale): ExperienceOutput {
  return {
    id: experience.id,
    company: experience.company,
    role: resolveLocale(experience.role, locale),
    startDate: experience.startDate,
    endDate: experience.endDate,
    current: experience.current,
    location: experience.location,
    sector: [...experience.sector],
    summary: resolveLocale(experience.summary, locale),
    highlights: resolveLocaleList(experience.highlights, locale),
    technologies: [...experience.technologies],
    tags: [...experience.tags],
    order: experience.order,
  };
}
