import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { Locale } from '@/shared/i18n/locale';
import { api, unwrap } from '@/shared/lib/api-client';
import type { PreviewCuratedProfile } from '@/shared/types/portfolio';
import { adminKeys } from '../shared/use-admin-api';
import { previewKey, toProfileBody, type ProfileDraft } from './profile-draft';

export const PREVIEW_DEBOUNCE_MS = 400;

/** Agrupa ráfagas de cambios en un solo valor (decisión D8). */
export function useDebounced<T>(value: T, delay = PREVIEW_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export async function fetchPreview(draft: ProfileDraft, locale: Locale): Promise<PreviewCuratedProfile> {
  const body = toProfileBody(draft);
  // El token de acceso no hace falta para previsualizar y no debe viajar de más.
  body.accessToken = null;
  return unwrap(
    await api.POST('/api/admin/curated-profiles/preview', {
      params: { query: { locale } },
      body,
    }),
  );
}

/**
 * Preview del borrador contra el backend (spec `curated-profile-builder`).
 * La clave ignora los tokens del tema: cambiar un color no vuelve a la red.
 * La consulta arranca cuando la clave se estabiliza, y usa el borrador del
 * render vigente en ese momento.
 */
export function usePreview(draft: ProfileDraft, locale: Locale = 'es') {
  const debouncedKey = useDebounced(previewKey(draft));

  return useQuery({
    queryKey: adminKeys.preview(debouncedKey, locale),
    queryFn: () => fetchPreview(draft, locale),
    placeholderData: (previous) => previous,
    staleTime: 60_000,
    // Los dos idiomas conviven en caché (D2): volver al anterior no re-consulta.
    gcTime: 5 * 60_000,
  });
}
