import type { LocalizedText } from '../shared/admin-types';
import { toLocalizedPayload } from '../shared/fields/localized';

export interface CategoryDraft {
  id?: string;
  name: LocalizedText;
  order: number;
}

export interface SkillDraft {
  id?: string;
  categoryId: string;
  categoryName: string;
  name: string;
  tags: string[];
  order: number;
}

/** Cuerpo que envía *Guardar* una categoría; también define qué cuenta como cambio (D12). */
export function toCategoryBody(draft: CategoryDraft) {
  return { name: toLocalizedPayload(draft.name), order: draft.order };
}

/** Cuerpo que envía *Guardar* una skill; también define qué cuenta como cambio (D12). */
export function toSkillBody(draft: SkillDraft) {
  return { name: draft.name.trim(), tags: draft.tags, order: draft.order };
}
