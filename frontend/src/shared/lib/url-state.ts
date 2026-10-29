import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { isLocale, type Locale } from '@/shared/i18n/locale';

/**
 * Estado compartible en la URL (decisión D6): idioma, preset de tema, layout y
 * token de acceso, más la atribución del link (`via`: código de un enlace de seguimiento,
 * `src`: portal; change `add-share-links`). Nada se persiste en `localStorage`.
 */
export interface UrlState {
  lang: Locale | null;
  theme: string | null;
  layout: string | null;
  token: string | null;
  via: string | null;
  src: string | null;
}

export const URL_KEYS = [
  'lang',
  'theme',
  'layout',
  'token',
  'via',
  'src',
] as const satisfies readonly (keyof UrlState)[];

export function readUrlState(params: URLSearchParams): UrlState {
  const lang = params.get('lang');
  return {
    lang: isLocale(lang) ? lang : null,
    theme: emptyToNull(params.get('theme')),
    layout: emptyToNull(params.get('layout')),
    token: emptyToNull(params.get('token')),
    via: emptyToNull(params.get('via')),
    src: emptyToNull(params.get('src')),
  };
}

/** Devuelve nuevos params: `null`/`undefined` en el patch elimina la clave. */
export function writeUrlState(params: URLSearchParams, patch: Partial<UrlState>): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of URL_KEYS) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (value === null || value === undefined || value === '') next.delete(key);
    else next.set(key, value);
  }
  return next;
}

export function useUrlState(): [UrlState, (patch: Partial<UrlState>) => void] {
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => readUrlState(params), [params]);
  const update = useCallback(
    (patch: Partial<UrlState>) => {
      setParams((current) => writeUrlState(current, patch), { replace: true });
    },
    [setParams],
  );
  return [state, update];
}

function emptyToNull(value: string | null): string | null {
  return value === null || value === '' ? null : value;
}
