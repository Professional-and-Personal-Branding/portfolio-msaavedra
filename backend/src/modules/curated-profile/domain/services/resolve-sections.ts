/** Orden por defecto de secciones cuando el perfil curado no define uno. */
export const DEFAULT_SECTIONS: readonly string[] = [
  'hero',
  'stats',
  'experience',
  'skills',
  'education',
  'certifications',
  'contact',
];

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
