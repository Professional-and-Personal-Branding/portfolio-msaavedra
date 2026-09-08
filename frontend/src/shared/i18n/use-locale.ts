import { useCallback, useMemo } from 'react';
import { useUrlState } from '@/shared/lib/url-state';
import { detectLocale, type Locale } from './locale';
import { translate, type MessageKey } from './messages';

export interface LocaleApi {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
}

/** Locale activo: `?lang=` > `navigator.language` (spec `frontend-localization`). */
export function useLocale(): LocaleApi {
  const [state, update] = useUrlState();
  const locale = state.lang ?? detectLocale(globalThis.navigator?.language);
  const setLocale = useCallback((next: Locale) => update({ lang: next }), [update]);
  const t = useCallback((key: MessageKey) => translate(locale, key), [locale]);
  return useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
}
