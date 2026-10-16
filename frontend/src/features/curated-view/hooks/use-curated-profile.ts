import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { Locale } from '@/shared/i18n/locale';
import { api, HttpError, unwrap } from '@/shared/lib/api-client';
import type { CuratedProfile, CuratedProfileSummary } from '@/shared/types/portfolio';
import { takeEarlyProfile } from '../early-profile';

export { HttpError } from '@/shared/lib/api-client';

export type CuratedProfileState =
  | { status: 'loading' }
  | { status: 'success'; data: CuratedProfile }
  | { status: 'needsToken'; invalidToken: boolean }
  | { status: 'notFound' }
  | { status: 'error'; error: Error; retry: () => void };

interface Options {
  locale: Locale;
  token: string | null;
}

export async function fetchCuratedProfile(
  slug: string,
  locale: Locale,
  token: string | null,
): Promise<CuratedProfile> {
  const early = takeEarlyProfile(slug, locale, token);
  return unwrap(
    await api.GET('/api/curated-profiles/{slug}', {
      params: {
        path: { slug },
        query: { locale },
        ...(token ? { header: { 'X-Access-Token': token } } : {}),
      },
      // La respuesta de la petición temprana reemplaza al `fetch`; el parseo y los errores son los de siempre.
      ...(early ? { fetch: () => early } : {}),
    }),
  );
}

export async function fetchCuratedProfiles(locale: Locale): Promise<CuratedProfileSummary[]> {
  return unwrap(await api.GET('/api/curated-profiles', { params: { query: { locale } } }));
}

/** Estado de vista del perfil curado (decisión D7). */
export function useCuratedProfile(slug: string, { locale, token }: Options): CuratedProfileState {
  const query = useQuery({
    queryKey: ['curated-profile', slug, locale, token],
    queryFn: () => fetchCuratedProfile(slug, locale, token),
    // Al cambiar idioma/token del mismo perfil se conserva lo anterior mientras llega lo nuevo.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === slug ? previous : undefined,
  });
  const retry = useCallback(() => void query.refetch(), [query]);

  if (query.data) return { status: 'success', data: query.data };
  if (query.isPending) return { status: 'loading' };
  const error = query.error;
  if (error instanceof HttpError && error.status === 401) {
    return { status: 'needsToken', invalidToken: token !== null };
  }
  if (error instanceof HttpError && error.status === 404) return { status: 'notFound' };
  return { status: 'error', error: error ?? new Error('unknown'), retry };
}

export function useCuratedProfiles(locale: Locale) {
  return useQuery({
    queryKey: ['curated-profiles', locale],
    queryFn: () => fetchCuratedProfiles(locale),
  });
}
