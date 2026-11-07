import { Locale, LocalizedList, LocalizedText, SUPPORTED_LOCALES } from './locale';

/** Un campo bilingüe tal como lo guarda el dominio, incluido el dato plano legado. */
export type LocalizedField = LocalizedText | LocalizedList | string | string[] | null | undefined;

const isBlank = (value: string | string[] | undefined): boolean =>
  value === undefined ||
  (typeof value === 'string' ? value.trim() === '' : value.every((item) => item.trim() === ''));

/**
 * Regla D4 (`add-bilingual-builder-parity`): un campo falta cuando está ausente,
 * vacío o es una lista vacía en `locale` Y tiene contenido en otro idioma.
 * - Igual al otro idioma NO es faltante (`Tech Lead`, `.NET`).
 * - Vacío en todos los idiomas (opcional sin llenar, p. ej. el headline del
 *   perfil curado `all`, que hereda el del perfil base) NO es faltante.
 * - Un dato plano legado (string / string[]) no se reporta.
 *
 * Es el predicado único: lo usan el aviso del constructor y la revisión de consistencia del
 * CV (D7 de `add-cv-consistency-rules`), así que no pueden divergir.
 */
export function isMissingTranslation(field: LocalizedField, locale: Locale): boolean {
  if (field == null || typeof field === 'string' || Array.isArray(field)) return false;
  const byLocale = field as Partial<Record<Locale, string | string[]>>;
  if (!isBlank(byLocale[locale])) return false;
  return SUPPORTED_LOCALES.some((other) => other !== locale && !isBlank(byLocale[other]));
}
