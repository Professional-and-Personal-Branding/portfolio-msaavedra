import type { CuratedProfile } from '@/shared/types/portfolio';

/** Secciones que el frontend sabe renderizar, en orden canónico (spec `layout-engine`). */
export const KNOWN_SECTIONS = [
  'hero',
  'stats',
  'experience',
  'skills',
  'projects',
  'education',
  'certifications',
  'presence',
  'contact',
] as const;

export type SectionId = (typeof KNOWN_SECTIONS)[number];

export function isKnownSection(value: string): value is SectionId {
  return (KNOWN_SECTIONS as readonly string[]).includes(value);
}

/** Una sección sin datos no se renderiza. */
export function hasData(section: SectionId, data: CuratedProfile): boolean {
  switch (section) {
    case 'hero':
    case 'stats':
      return data.profile !== null && data.profile !== undefined;
    case 'experience':
      return data.experiences.length > 0;
    case 'skills':
      return data.skillCategories.length > 0;
    case 'projects':
      return data.projects.length > 0;
    case 'education':
      return data.education.length > 0;
    case 'certifications':
      return data.certifications.length > 0;
    case 'presence':
      return data.socialLinks.length > 0;
    case 'contact':
      return Boolean(data.profile?.email);
  }
}

/**
 * Orden de la API primero (solo secciones conocidas); luego las conocidas que
 * no figuran ni en `sections` ni en `hidden`, en orden canónico. Se descartan
 * ocultas y vacías.
 */
export function orderSections(
  sections: readonly string[],
  hidden: readonly string[],
  data: CuratedProfile,
): SectionId[] {
  const hiddenSet = new Set(hidden);
  const result: SectionId[] = [];
  const seen = new Set<string>();

  for (const id of sections) {
    if (!isKnownSection(id) || seen.has(id)) continue;
    seen.add(id);
    if (!hiddenSet.has(id) && hasData(id, data)) result.push(id);
  }
  for (const id of KNOWN_SECTIONS) {
    if (seen.has(id) || hiddenSet.has(id)) continue;
    if (hasData(id, data)) result.push(id);
  }
  return result;
}
