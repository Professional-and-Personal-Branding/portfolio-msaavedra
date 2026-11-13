import { MIN_REPOSITORIES_FOR_SECTION, SectionId } from '../../domain/services/resolve-sections';
import { CuratedProfileOutput } from '../dto/curated-profile.output';

/**
 * Qué secciones del catálogo tienen algo que mostrar en una vista ya resuelta
 * (después del filtrado por tags). Es la única definición de "sección con datos"
 * del sistema: el cliente renderiza `sections` tal como llega (spec `layout-engine`).
 */
export function sectionsWithData(output: CuratedProfileOutput): Set<SectionId> {
  const has: Record<SectionId, boolean> = {
    hero: output.profile !== null,
    stats: output.profile !== null,
    experience: output.experiences.length > 0,
    skills: output.skillCategories.length > 0,
    projects: output.projects.length > 0,
    repositories: output.repositories.length >= MIN_REPOSITORIES_FOR_SECTION,
    education: output.education.length > 0,
    certifications: output.certifications.length > 0,
    presence: output.socialLinks.length > 0,
    contact: Boolean(output.profile?.email),
  };
  return new Set((Object.keys(has) as SectionId[]).filter((id) => has[id]));
}
