import type {
  AdminExperience,
  AdminProject,
  AdminRepository,
  AdminSkillCategory,
} from '../shared/admin-types';
import type { ProfileDraft } from './profile-draft';

/**
 * Overrides de selección del borrador (change `add-builder-skill-project-overrides`).
 * Experiencias, skills, proyectos y repositorios comparten `includeIds`/`excludeIds` como ids crudos (D2);
 * el tipo de cada id se reconoce por pertenencia a la lista cargada, nunca por su formato.
 */
export type OverrideMode = 'include' | 'exclude' | 'none';

type Overrides = Pick<ProfileDraft, 'includeIds' | 'excludeIds'>;

/**
 * Estado de un ítem. Un id en los dos arreglos (solo posible por API o seed) cuenta como
 * excluido, que es lo que hace el núcleo: `excludeIds` siempre gana (D5).
 */
export function overrideState(draft: Overrides, id: string): OverrideMode {
  if (draft.excludeIds.includes(id)) return 'exclude';
  if (draft.includeIds.includes(id)) return 'include';
  return 'none';
}

/** El id figura en los dos arreglos: la exclusión gana y la fila lo aclara. */
export function hasOverrideConflict(draft: Overrides, id: string): boolean {
  return draft.includeIds.includes(id) && draft.excludeIds.includes(id);
}

/**
 * Fija el override de un ítem sin mutar. Incluir lo quita de `excludeIds` y excluir lo quita de
 * `includeIds` (exclusión mutua, D5); `none` lo saca de los dos. Nunca duplica ids.
 */
export function setOverride<T extends Overrides>(draft: T, id: string, mode: OverrideMode): T {
  const without = (ids: readonly string[]) => ids.filter((item) => item !== id);
  return {
    ...draft,
    includeIds: mode === 'include' ? [...without(draft.includeIds), id] : without(draft.includeIds),
    excludeIds: mode === 'exclude' ? [...without(draft.excludeIds), id] : without(draft.excludeIds),
  };
}

/**
 * Ids de los dos arreglos que no corresponden a ninguna experiencia, skill, proyecto ni
 * repositorio cargados (el ítem se borró). Sin duplicados; el núcleo los ignora (D7). Solo tiene
 * sentido con las cuatro listas cargadas: con una ausente no se sabe de qué lista era cada id.
 */
export function orphanOverrideIds(
  draft: Overrides,
  experiences: readonly AdminExperience[],
  categories: readonly AdminSkillCategory[],
  projects: readonly AdminProject[],
  repositories: readonly AdminRepository[],
): string[] {
  const known = new Set<string>([
    ...experiences.map((experience) => experience.id),
    ...categories.flatMap((category) => category.skills.map((skill) => skill.id)),
    ...projects.map((project) => project.id),
    ...repositories.map((repository) => repository.id),
  ]);
  return [...new Set([...draft.includeIds, ...draft.excludeIds])].filter((id) => !known.has(id));
}

/** Saca los ids dados de los dos arreglos. */
export function removeOverrideIds<T extends Overrides>(draft: T, ids: readonly string[]): T {
  const drop = new Set(ids);
  return {
    ...draft,
    includeIds: draft.includeIds.filter((id) => !drop.has(id)),
    excludeIds: draft.excludeIds.filter((id) => !drop.has(id)),
  };
}

/** Minúsculas y sin marcas diacríticas: «Ñandú» coincide con «nandu». */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Filtra las skills por nombre (no por categoría) y descarta las categorías sin coincidencias.
 * Una búsqueda vacía o de solo espacios devuelve todo (D10).
 */
export function filterSkillCategories(
  categories: readonly AdminSkillCategory[],
  query: string,
): AdminSkillCategory[] {
  const needle = fold(query.trim());
  if (!needle) return [...categories];
  return categories
    .map((category) => ({
      ...category,
      skills: category.skills.filter((skill) => fold(skill.name).includes(needle)),
    }))
    .filter((category) => category.skills.length > 0);
}

/** Cuántas skills de la categoría están forzadas o quitadas (un conflicto cuenta como excluida). */
export function categoryOverrideCounts(
  draft: Overrides,
  category: AdminSkillCategory,
): { included: number; excluded: number } {
  let included = 0;
  let excluded = 0;
  for (const skill of category.skills) {
    const state = overrideState(draft, skill.id);
    if (state === 'include') included += 1;
    else if (state === 'exclude') excluded += 1;
  }
  return { included, excluded };
}
