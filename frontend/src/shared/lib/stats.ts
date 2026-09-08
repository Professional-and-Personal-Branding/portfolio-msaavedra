import type { CuratedProfile } from '@/shared/types/portfolio';

export interface PortfolioStats {
  years: number;
  experiences: number;
  technologies: number;
  certifications: number;
}

/** Estadísticas derivadas de los datos resueltos (spec `layout-engine` § Estadísticas). */
export function computeStats(
  data: Pick<CuratedProfile, 'profile' | 'experiences' | 'certifications'>,
): PortfolioStats {
  const technologies = new Set<string>();
  for (const experience of data.experiences) {
    for (const tech of experience.technologies) technologies.add(tech.trim().toLowerCase());
  }
  return {
    years: data.profile?.yearsOfExperience ?? 0,
    experiences: data.experiences.length,
    technologies: technologies.size,
    certifications: data.certifications.length,
  };
}
