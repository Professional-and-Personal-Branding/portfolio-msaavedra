import { isSectionId, SECTION_IDS, type SectionId } from '@/themes/layouts/sections';
import type {
  AdminCuratedProfile,
  AdminExperience,
  AdminSkillCategory,
  CreateCuratedProfileBody,
  LocalizedText,
  Visibility,
} from '../shared/admin-types';
import { toLocalizedPayload } from '../shared/fields/localized';

export interface ProfileDraft {
  slug: string;
  title: LocalizedText;
  headline: LocalizedText;
  description: LocalizedText;
  roleType: LocalizedText;
  techFocus: string;
  filterTags: string[];
  includeIds: string[];
  excludeIds: string[];
  accentColor: string;
  themeId: string | null;
  themeOverrides: Record<string, unknown> | null;
  layout: string;
  sectionsOrder: SectionId[];
  sectionsHidden: SectionId[];
  visibility: Visibility;
  accessToken: string;
}

/** Un perfil nuevo arranca con el catálogo completo, en orden canónico. */
export const DEFAULT_SECTIONS: readonly SectionId[] = SECTION_IDS;

export const EMPTY_DRAFT: ProfileDraft = {
  slug: '',
  title: { es: '', en: '' },
  headline: { es: '', en: '' },
  description: { es: '', en: '' },
  roleType: { es: '', en: '' },
  techFocus: '',
  filterTags: [],
  includeIds: [],
  excludeIds: [],
  accentColor: '#1A365D',
  themeId: null,
  themeOverrides: null,
  layout: 'classic',
  sectionsOrder: [...DEFAULT_SECTIONS],
  sectionsHidden: [],
  visibility: 'PUBLIC',
  accessToken: '',
};

export function toDraft(profile: AdminCuratedProfile): ProfileDraft {
  return {
    slug: profile.slug,
    title: { es: profile.title.es, en: profile.title.en ?? '' },
    headline: { es: profile.headline.es, en: profile.headline.en ?? '' },
    description: { es: profile.description?.es ?? '', en: profile.description?.en ?? '' },
    roleType: { es: profile.roleType?.es ?? '', en: profile.roleType?.en ?? '' },
    techFocus: profile.techFocus ?? '',
    filterTags: [...profile.filterTags],
    includeIds: [...profile.includeIds],
    excludeIds: [...profile.excludeIds],
    accentColor: profile.accentColor,
    themeId: profile.themeId,
    themeOverrides: (profile.themeOverrides as Record<string, unknown> | null) ?? null,
    layout: profile.layout,
    // Una fila anterior a la validación de ids podría traer alguno fuera del
    // catálogo: el panel no puede mostrarlo ni quitarlo, así que se descarta al
    // cargar y guardar deja el dato limpio. La API, en cambio, lo rechaza.
    sectionsOrder:
      profile.sectionsOrder.length > 0
        ? profile.sectionsOrder.filter(isSectionId)
        : [...DEFAULT_SECTIONS],
    sectionsHidden: profile.sectionsHidden.filter(isSectionId),
    visibility: profile.visibility,
    accessToken: profile.accessToken ?? '',
  };
}

/** Cuerpo para crear o actualizar. Los textos vacíos viajan como `null`. */
export function toProfileBody(draft: ProfileDraft): CreateCuratedProfileBody {
  return {
    slug: draft.slug.trim(),
    title: toLocalizedPayload(draft.title),
    headline: toLocalizedPayload(draft.headline),
    description: draft.description.es.trim() ? toLocalizedPayload(draft.description) : null,
    roleType: draft.roleType.es.trim() ? toLocalizedPayload(draft.roleType) : null,
    techFocus: draft.techFocus.trim() || null,
    filterTags: draft.filterTags,
    includeIds: draft.includeIds,
    excludeIds: draft.excludeIds,
    accentColor: draft.accentColor,
    themeId: draft.themeId,
    themeOverrides: draft.themeOverrides,
    layout: draft.layout,
    sectionsOrder: draft.sectionsOrder,
    sectionsHidden: draft.sectionsHidden,
    visibility: draft.visibility,
    accessToken: draft.visibility === 'PROTECTED' ? draft.accessToken.trim() : null,
  };
}

/**
 * Clave del preview: todo lo que cambia la selección o el orden de secciones.
 * Los tokens del tema quedan fuera a propósito, porque el customizador los
 * aplica en el cliente (decisión D8).
 */
export function previewKey(draft: ProfileDraft): string {
  return JSON.stringify({
    slug: draft.slug,
    title: draft.title,
    headline: draft.headline,
    description: draft.description,
    roleType: draft.roleType,
    techFocus: draft.techFocus,
    filterTags: [...draft.filterTags].sort(),
    includeIds: [...draft.includeIds].sort(),
    excludeIds: [...draft.excludeIds].sort(),
    layout: draft.layout,
    sectionsOrder: draft.sectionsOrder,
    sectionsHidden: draft.sectionsHidden,
  });
}

export interface DraftErrors {
  slug?: string;
  title?: string;
  headline?: string;
  accessToken?: string;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateDraft(draft: ProfileDraft): DraftErrors {
  const errors: DraftErrors = {};
  const slug = draft.slug.trim();
  if (!slug) errors.slug = 'El slug es obligatorio';
  else if (!SLUG_PATTERN.test(slug))
    errors.slug = 'Usá kebab-case: solo minúsculas, números y guiones';
  if (!draft.title.es.trim()) errors.title = 'El título en español es obligatorio';
  // El titular es opcional (D7): vacío, el hero usa el del perfil base. Si hay
  // traducción, el español —el idioma origen— no puede faltar.
  if (!draft.headline.es.trim() && draft.headline.en?.trim()) {
    errors.headline = 'Falta el titular en español';
  }
  if (draft.visibility === 'PROTECTED' && !draft.accessToken.trim()) {
    errors.accessToken = 'Un perfil protegido necesita un token de acceso';
  }
  return errors;
}

/** Universo de tags disponible, tomado de los datos reales. */
export function tagUniverse(
  experiences: readonly AdminExperience[] = [],
  categories: readonly AdminSkillCategory[] = [],
  extra: readonly string[] = [],
): string[] {
  const tags = new Set<string>(extra);
  for (const experience of experiences) for (const tag of experience.tags) tags.add(tag);
  for (const category of categories) {
    for (const skill of category.skills) for (const tag of skill.tags) tags.add(tag);
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
}

/** Mueve una sección una posición arriba o abajo (spec `curated-profile-builder`). */
export function moveSection<T>(sections: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= sections.length || target < 0 || target >= sections.length) {
    return sections;
  }
  const next = [...sections];
  const moved = next[index]!;
  next[index] = next[target]!;
  next[target] = moved;
  return next;
}

/** Todas las secciones conocidas, con el orden del perfil primero. */
export function allSections(sectionsOrder: readonly SectionId[]): SectionId[] {
  const known = sectionsOrder.filter((s) => SECTION_IDS.includes(s));
  const missing = SECTION_IDS.filter((s) => !known.includes(s));
  return [...known, ...missing];
}
