/**
 * i18n — Fachada de infraestructura.
 *
 * El núcleo puro (tipos, resolveLocale, resolveLocaleList, DEFAULT_LOCALE) vive en
 * `shared/domain/i18n` para que domain y application puedan usarlo sin violar la
 * regla de dependencia. Este archivo conserva la ruta histórica citada en CLAUDE.md
 * e I18N.md re-exportando ese núcleo, y agrega `normalizeLocale`, que sí es una
 * preocupación de infraestructura (parsear query params y headers HTTP).
 */
import { DEFAULT_LOCALE, isSupportedLocale, Locale } from '../../domain/i18n';

export {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  localize,
  localizeList,
  resolveLocale,
  resolveLocaleList,
  type Locale,
  type LocalizedList,
  type LocalizedText,
} from '../../domain/i18n';

/**
 * Normaliza una entrada arbitraria (query param, header) a un Locale válido.
 * Acepta "en", "EN", "en-US", "es-BO", etc. Cae al default si no reconoce.
 */
export function normalizeLocale(input: string | null | undefined): Locale {
  if (!input) return DEFAULT_LOCALE;
  const base = input.toLowerCase().split('-')[0].trim();
  return isSupportedLocale(base) ? base : DEFAULT_LOCALE;
}

/**
 * Elige el primer idioma soportado de un header `Accept-Language`
 * (respeta el orden de preferencia / q-values). Devuelve undefined si ninguno aplica,
 * para que el llamador decida el fallback.
 */
export function pickFromAcceptLanguage(header: string | null | undefined): Locale | undefined {
  if (!header) return undefined;
  const candidates = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith('q='))
        ?.slice(2);
      const quality = q === undefined ? 1 : Number.parseFloat(q);
      return { tag: tag.trim(), quality: Number.isNaN(quality) ? 0 : quality };
    })
    .filter((c) => c.tag.length > 0 && c.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of candidates) {
    const base = tag.toLowerCase().split('-')[0];
    if (isSupportedLocale(base)) return base;
  }
  return undefined;
}
