import type { LocalizedText } from '../shared/admin-types';
import { toLocalizedPayload } from '../shared/fields/localized';

export interface LanguageDraft {
  id?: string;
  name: string;
  nameI18n: LocalizedText;
  level: string;
  detail: LocalizedText;
}

export const EMPTY_LANGUAGE: LanguageDraft = {
  name: '',
  nameI18n: { es: '', en: '' },
  level: '',
  detail: { es: '', en: '' },
};

export function editableText(value: unknown): LocalizedText {
  if (value == null) return { es: '', en: '' };
  if (typeof value === 'string') return { es: value, en: '' };
  const text = value as LocalizedText;
  return { es: text.es ?? '', en: text.en ?? '' };
}

/** Bilingüe opcional: vacío en los dos idiomas → `null`. */
export function optionalPayload(value: LocalizedText): LocalizedText | null {
  const payload = toLocalizedPayload(value);
  return payload.es || payload.en ? payload : null;
}

/** Cuerpo que envía *Guardar* un idioma; también define qué cuenta como cambio (D12). */
export function toLanguageBody(draft: LanguageDraft) {
  return {
    name: draft.name.trim(),
    nameI18n: optionalPayload(draft.nameI18n),
    level: draft.level.trim(),
    detail: optionalPayload(draft.detail),
  };
}
