import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { Locale } from '@/shared/i18n/locale';
import { api } from '@/shared/lib/api-client';
import type { CuratedProfile, CuratedProfileSummary } from '@/shared/types/portfolio';

/** Error HTTP con el status, para distinguir 401/404 de fallos de red. */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

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
  const { data, error, response } = await api.GET('/api/curated-profiles/{slug}', {
    params: {
      path: { slug },
      query: { locale },
      ...(token ? { header: { 'X-Access-Token': token } } : {}),
    },
  });
  if (data) return data;
  throw new HttpError(response.status, messageOf(error) ?? response.statusText);
}

export async function fetchCuratedProfiles(locale: Locale): Promise<CuratedProfileSummary[]> {
  const { data, error, response } = await api.GET('/api/curated-profiles', {
    params: { query: { locale } },
  });
  if (data) return data;
  throw new HttpError(response.status, messageOf(error) ?? response.statusText);
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

function messageOf(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join(', ');
  }
  return undefined;
}
