import type { LocalizedList, LocalizedText } from '../admin-types';

/**
 * Normaliza un campo traducible para enviarlo a la API: recorta, exige `es` y
 * omite `en` cuando está vacío (spec `admin-content-management`).
 */
export function toLocalizedPayload(value: LocalizedText | undefined): LocalizedText {
  const es = (value?.es ?? '').trim();
  const en = (value?.en ?? '').trim();
  return en ? { es, en } : { es };
}

/** Igual que `toLocalizedPayload` pero para listas (`highlights`). */
export function toLocalizedListPayload(value: LocalizedList | undefined): LocalizedList {
  const es = clean(value?.es);
  const en = clean(value?.en);
  return en.length > 0 ? { es, en } : { es };
}

function clean(items: string[] | undefined): string[] {
  return (items ?? []).map((item) => item.trim()).filter((item) => item.length > 0);
}
