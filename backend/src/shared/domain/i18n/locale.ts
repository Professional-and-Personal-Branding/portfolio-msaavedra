/**
 * Tipos i18n del dominio. Un solo dato, múltiples idiomas, sin duplicar registros.
 * Los campos traducibles se modelan como LocalizedText / LocalizedList.
 * Este archivo no depende de nada externo (regla de dependencia).
 */

export type Locale = 'es' | 'en';

export type LocalizedText = Partial<Record<Locale, string>>;
export type LocalizedList = Partial<Record<Locale, string[]>>;

/** Idioma origen del seed; se usa como fallback. */
export const DEFAULT_LOCALE: Locale = 'es';

export const SUPPORTED_LOCALES: readonly Locale[] = ['es', 'en'];

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
