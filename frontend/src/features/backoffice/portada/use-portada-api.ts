import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Locale } from '@/shared/i18n/locale';
import { api, apiErrorMessage, unwrap } from '@/shared/lib/api-client';
import { useDebounced } from '../curated-profiles/use-preview';
import type {
  AdminLanguage,
  AdminProfile,
  CreateLanguageBody,
  ProfilePreview,
  UpdateLanguageBody,
} from '../shared/admin-types';
import { adminKeys, invalidate } from '../shared/use-admin-api';
import { portadaKey, toReplaceBody, type PortadaDraft } from './portada-draft';

// ── Perfil base ─────────────────────────────────────────────────────────────
export function useAdminProfile() {
  return useQuery({
    queryKey: adminKeys.profile,
    queryFn: async (): Promise<AdminProfile> => unwrap(await api.GET('/api/admin/profile')),
  });
}

export function useReplaceProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (draft: PortadaDraft): Promise<AdminProfile> =>
      unwrap(await api.PUT('/api/admin/profile', { body: toReplaceBody(draft) })),
    onSuccess: () => {
      invalidate(client, adminKeys.profile);
      // Los perfiles curados muestran el perfil base: su preview queda vieja.
      invalidate(client, ['admin', 'preview']);
    },
  });
}

/**
 * Vista previa del hero sin guardar (D4): el backend resuelve el borrador con el
 * mismo mapper que la ruta pública. Solo pide cuando el borrador es válido y se
 * estabiliza.
 */
export function useProfilePreview(draft: PortadaDraft, locale: Locale, enabled: boolean) {
  const key = useDebounced(portadaKey(draft));
  return useQuery({
    queryKey: adminKeys.profilePreview(`${key}|${locale}`),
    queryFn: async (): Promise<ProfilePreview> =>
      unwrap(
        await api.POST('/api/admin/profile/preview', {
          params: { query: { locale } },
          body: toReplaceBody(draft),
        }),
      ),
    enabled,
    placeholderData: (previous) => previous,
    staleTime: 60_000,
  });
}

// ── Idiomas ─────────────────────────────────────────────────────────────────
export function useLanguages() {
  return useQuery({
    queryKey: adminKeys.languages,
    queryFn: async (): Promise<AdminLanguage[]> => unwrap(await api.GET('/api/admin/languages')),
  });
}

export function useSaveLanguage() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; body: CreateLanguageBody | UpdateLanguageBody }) =>
      input.id
        ? unwrap(
            await api.PATCH('/api/admin/languages/{id}', {
              params: { path: { id: input.id } },
              body: input.body as UpdateLanguageBody,
            }),
          )
        : unwrap(
            await api.POST('/api/admin/languages', { body: input.body as CreateLanguageBody }),
          ),
    onSuccess: () => invalidate(client, adminKeys.languages),
  });
}

export function useDeleteLanguage() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await api.DELETE('/api/admin/languages/{id}', { params: { path: { id } } });
      if (result.error) throw new Error(apiErrorMessage(result.error) ?? 'No se pudo borrar');
    },
    onSuccess: () => invalidate(client, adminKeys.languages),
  });
}
