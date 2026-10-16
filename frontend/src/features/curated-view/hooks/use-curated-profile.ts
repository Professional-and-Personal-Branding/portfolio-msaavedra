import { useQuery } from '@tanstack/react-query';
import { useCallback, useDeferredValue, useMemo } from 'react';
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

  // El render que depende del perfil pasa a prioridad de transición (D2 de
  // `improve-mobile-performance`): la notificación de TanStack Query es síncrona y no se puede
  // interrumpir. El valor diferido lleva su slug para no mostrar el perfil de otra ruta mientras
  // se pone al día; un cambio de idioma o token del mismo slug sí conserva el anterior.
  const current = useMemo(
    () => (query.data ? { slug, data: query.data } : undefined),
    [slug, query.data],
  );
  const deferred = useDeferredValue(current);

  if (query.data) {
    return deferred?.slug === slug
      ? { status: 'success', data: deferred.data }
      : { status: 'loading' };
  }
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
