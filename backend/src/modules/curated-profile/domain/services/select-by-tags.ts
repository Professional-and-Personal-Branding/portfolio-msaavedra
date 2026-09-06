/**
 * Selección por intersección de tags con overrides (spec `curated-profile-resolution`).
 * Genérica: sirve para experiencias, skills y, en el futuro, proyectos.
 *   - `filterTags` vacío → todo pasa el filtro por tags.
 *   - `excludeIds` gana siempre (también sobre `includeIds`).
 *   - `includeIds` fuerza la inclusión aunque no haya intersección.
 *   - Conserva el orden de entrada y no muta. Ids desconocidos se ignoran.
 * La visibilidad NO se decide acá: el llamador pasa solo items visibles.
 */
export interface Taggable {
  readonly id: string;
  readonly tags: readonly string[];
}

export interface SelectionCriteria {
  readonly filterTags: readonly string[];
  readonly includeIds: readonly string[];
  readonly excludeIds: readonly string[];
}

export function matchesAnyTag(tags: readonly string[], filterTags: readonly string[]): boolean {
  if (filterTags.length === 0) return true;
  return tags.some((tag) => filterTags.includes(tag));
}

export function selectByTags<T extends Taggable>(
  items: readonly T[],
  criteria: SelectionCriteria,
): T[] {
  const include = new Set(criteria.includeIds);
  const exclude = new Set(criteria.excludeIds);
  return items.filter(
    (item) =>
      !exclude.has(item.id) &&
      (include.has(item.id) || matchesAnyTag(item.tags, criteria.filterTags)),
  );
}
