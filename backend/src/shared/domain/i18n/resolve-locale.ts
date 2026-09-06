/**
 * i18n — Resolución de idioma (el "function switch" central del portafolio).
 *
 * Este es el ÚNICO punto donde se decide qué idioma sale. Cambiar el idioma
 * de toda la respuesta = pasar un `locale` distinto.
 * Orden de fallback: locale demandado → fallback → primer valor disponible → vacío.
 */
import { DEFAULT_LOCALE, Locale, LocalizedList, LocalizedText } from './locale';

/**
 * Resuelve un campo de texto localizado al idioma demandado.
 * Acepta también un string plano (compatibilidad con datos no migrados).
 */
export function resolveLocale(
  field: LocalizedText | string | null | undefined,
  locale: Locale,
  fallback: Locale = DEFAULT_LOCALE,
): string {
  if (field == null) return '';
  if (typeof field === 'string') return field; // dato plano legacy
  return field[locale] ?? field[fallback] ?? firstDefined(Object.values(field)) ?? '';
}

/**
 * Resuelve una lista de texto localizada (ej. highlights/bullets).
 * Acepta también un string[] plano (compatibilidad).
 */
export function resolveLocaleList(
  field: LocalizedList | string[] | null | undefined,
  locale: Locale,
  fallback: Locale = DEFAULT_LOCALE,
): string[] {
  if (field == null) return [];
  if (Array.isArray(field)) return field; // dato plano legacy
  return field[locale] ?? field[fallback] ?? firstDefined(Object.values(field)) ?? [];
}

/** Helper para construir un LocalizedText desde código/seed. */
export function localize(es: string, en: string): LocalizedText {
  return { es, en };
}

export function localizeList(es: string[], en: string[]): LocalizedList {
  return { es, en };
}

function firstDefined<T>(values: (T | undefined)[]): T | undefined {
  return values.find((v) => v !== undefined);
}
