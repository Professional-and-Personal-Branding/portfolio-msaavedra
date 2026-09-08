/** Locales soportados, espejo de `Locale` del backend (docs/I18N.md). */
export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'es';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** `en*` → `en`; cualquier otro idioma → `es` (spec `frontend-localization`). */
export function detectLocale(navigatorLanguage: string | undefined | null): Locale {
  if (!navigatorLanguage) return DEFAULT_LOCALE;
  return navigatorLanguage.toLowerCase().startsWith('en') ? 'en' : DEFAULT_LOCALE;
}
