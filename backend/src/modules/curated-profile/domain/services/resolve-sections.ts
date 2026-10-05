/**
 * Catálogo canónico de secciones (spec `curated-profile-resolution`). Es la
 * única lista del sistema: viaja al frontend como enum del OpenAPI y el cliente
 * deriva su tipo de ahí, así que agregar un id acá obliga a implementarlo allá.
 */
export const SECTION_IDS = [
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

export type SectionId = (typeof SECTION_IDS)[number];

/** Orden cuando el perfil curado no define uno: el catálogo completo. */
export const DEFAULT_SECTIONS: readonly SectionId[] = SECTION_IDS;

export function isSectionId(value: string): value is SectionId {
  return (SECTION_IDS as readonly string[]).includes(value);
}

export interface ResolvedSections {
  /** Secciones visibles, en el orden final. */
  readonly sections: string[];
  /** Secciones ocultas (informativo, sin duplicados). */
  readonly hiddenSections: string[];
}

export function resolveSections(
  sectionsOrder: readonly string[],
  sectionsHidden: readonly string[],
): ResolvedSections {
  const base = sectionsOrder.length > 0 ? sectionsOrder : DEFAULT_SECTIONS;
  const hidden = new Set(sectionsHidden);
  return {
    sections: base.filter((section) => !hidden.has(section)),
    hiddenSections: [...hidden],
  };
}

/**
 * Orden final que se renderiza: el resuelto, solo con ids del catálogo, sin
 * repetidos y sin secciones vacías; después, al final y en orden canónico, las
 * del catálogo que tienen datos y no figuraban ni estaban ocultas. Nunca
 * reordena lo que ya venía.
 */
export function completeSections(
  resolved: ResolvedSections,
  withData: ReadonlySet<SectionId>,
): SectionId[] {
  const hidden = new Set(resolved.hiddenSections);
  const seen = new Set<string>();
  const result: SectionId[] = [];

  for (const id of resolved.sections) {
    if (!isSectionId(id) || seen.has(id)) continue;
    seen.add(id);
    if (withData.has(id)) result.push(id);
  }
  for (const id of SECTION_IDS) {
    if (seen.has(id) || hidden.has(id)) continue;
    if (withData.has(id)) result.push(id);
  }
  return result;
}
