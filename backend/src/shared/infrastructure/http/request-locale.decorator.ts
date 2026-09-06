import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { DEFAULT_LOCALE, Locale } from '../../domain/i18n';
import { isSupportedLocale, pickFromAcceptLanguage } from '../i18n/resolve-locale';

/** Clave bajo la que se guarda el locale resuelto en la request (la lee el interceptor). */
export const REQUEST_LOCALE_KEY = 'portfolioLocale';

type LocaleAwareRequest = Request & { [REQUEST_LOCALE_KEY]?: Locale };

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

function normalize(raw: string | undefined): Locale | undefined {
  if (!raw) return undefined;
  const base = raw.toLowerCase().split('-')[0].trim();
  return isSupportedLocale(base) ? base : undefined;
}

/**
 * Resuelve el locale de una request con la precedencia de la spec `content-localization`:
 *   query `locale` → query `lang` → header `Accept-Language` → DEFAULT_LOCALE.
 * Un valor no soportado en un nivel NO corta la cadena: se sigue al siguiente nivel.
 */
export function resolveRequestLocale(req: LocaleAwareRequest): Locale {
  const cached = req[REQUEST_LOCALE_KEY];
  if (cached) return cached;

  const query = (req.query ?? {}) as Record<string, unknown>;
  const locale =
    normalize(firstString(query['locale'])) ??
    normalize(firstString(query['lang'])) ??
    pickFromAcceptLanguage(req.headers?.['accept-language']) ??
    DEFAULT_LOCALE;

  req[REQUEST_LOCALE_KEY] = locale;
  return locale;
}

/** Parámetro de controller: `@RequestLocale() locale: Locale`. */
export const RequestLocale = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Locale => {
    const req = ctx.switchToHttp().getRequest<LocaleAwareRequest>();
    return resolveRequestLocale(req);
  },
);
