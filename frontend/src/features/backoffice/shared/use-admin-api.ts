import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiErrorMessage, unwrap } from '@/shared/lib/api-client';
import type {
  AdminCuratedProfile,
  AdminExperience,
  AdminSkillCategory,
  AdminTheme,
  CreateCuratedProfileBody,
  CreateExperienceBody,
  CreateShareLinkBody,
  CreateSkillBody,
  CreateSkillCategoryBody,
  CvConsistency,
  ProfileViews,
  ShareLink,
  UpdateCuratedProfileBody,
  UpdateExperienceBody,
} from './admin-types';

export const adminKeys = {
  experiences: ['admin', 'experiences'] as const,
  skillCategories: ['admin', 'skill-categories'] as const,
  curatedProfiles: ['admin', 'curated-profiles'] as const,
  themes: ['admin', 'themes'] as const,
  profile: ['admin', 'profile'] as const,
  profilePreview: (draftKey: string) => ['admin', 'profile-preview', draftKey] as const,
  languages: ['admin', 'languages'] as const,
  education: ['admin', 'education'] as const,
  certifications: ['admin', 'certifications'] as const,
  projects: ['admin', 'projects'] as const,
  featuredRepositories: ['admin', 'featured-repositories'] as const,
  socialLinks: ['admin', 'social-links'] as const,
  shareLinks: (profileId: string) => ['admin', 'share-links', profileId] as const,
  applications: ['admin', 'applications'] as const,
  applicationList: (status: string) => ['admin', 'applications', 'list', status] as const,
  applicationSummary: ['admin', 'applications', 'summary'] as const,
  jobPostings: ['admin', 'job-postings'] as const,
  jobPosting: (id: string) => ['admin', 'job-postings', 'one', id] as const,
  jobPostingSuggestion: (id: string) => ['admin', 'job-postings', 'suggestion', id] as const,
  consistency: ['admin', 'consistency'] as const,
  integrations: ['admin', 'integrations'] as const,
  analytics: (from: string, to: string) => ['admin', 'analytics', from, to] as const,
  preview: (draftKey: string, locale: string) => ['admin', 'preview', draftKey, locale] as const,
};

/** Aviso de éxito o de error para cada escritura (spec `admin-content-management`). */
export function notifySuccess(message: string): void {
  toast.success(message);
}

export function notifyError(error: unknown, fallback = 'No se pudo guardar'): void {
  toast.error(apiErrorMessage(error) ?? (error instanceof Error ? error.message : fallback));
}

export function invalidate(client: QueryClient, key: readonly unknown[]): void {
  void client.invalidateQueries({ queryKey: key });
}

// ── Experiencias ────────────────────────────────────────────────────────────
export function useExperiences() {
  return useQuery({
    queryKey: adminKeys.experiences,
    queryFn: async (): Promise<AdminExperience[]> =>
      unwrap(await api.GET('/api/admin/experiences')),
  });
}

export function useSaveExperience() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      body: CreateExperienceBody | UpdateExperienceBody;
    }) =>
      input.id !== undefined
        ? unwrap(
            await api.PATCH('/api/admin/experiences/{id}', {
              params: { path: { id: input.id } },
              body: input.body as UpdateExperienceBody,
            }),
          )
        : unwrap(
            await api.POST('/api/admin/experiences', {
              body: input.body as CreateExperienceBody,
            }),
          ),
    onSuccess: () => invalidate(client, adminKeys.experiences),
  });
}

export function useDeleteExperience() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await api.DELETE('/api/admin/experiences/{id}', {
        params: { path: { id } },
      });
      if (result.error) throw new Error(apiErrorMessage(result.error) ?? 'No se pudo borrar');
    },
    onSuccess: () => invalidate(client, adminKeys.experiences),
  });
}

// ── Skills ──────────────────────────────────────────────────────────────────
export function useSkillCategories() {
  return useQuery({
    queryKey: adminKeys.skillCategories,
    queryFn: async (): Promise<AdminSkillCategory[]> =>
      unwrap(await api.GET('/api/admin/skill-categories')),
  });
}

export function useSaveSkillCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; body: CreateSkillCategoryBody }) =>
      input.id !== undefined
        ? unwrap(
            await api.PATCH('/api/admin/skill-categories/{id}', {
              params: { path: { id: input.id } },
              body: input.body,
            }),
          )
        : unwrap(await api.POST('/api/admin/skill-categories', { body: input.body })),
    onSuccess: () => invalidate(client, adminKeys.skillCategories),
  });
}

export function useDeleteSkillCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await api.DELETE('/api/admin/skill-categories/{id}', {
        params: { path: { id } },
      });
      if (result.error) throw new Error(apiErrorMessage(result.error) ?? 'No se pudo borrar');
    },
    onSuccess: () => invalidate(client, adminKeys.skillCategories),
  });
}

export function useSaveSkill() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; categoryId: string; body: CreateSkillBody }) =>
      input.id !== undefined
        ? unwrap(
            await api.PATCH('/api/admin/skills/{id}', {
              params: { path: { id: input.id } },
              body: input.body,
            }),
          )
        : unwrap(
            await api.POST('/api/admin/skill-categories/{categoryId}/skills', {
              params: { path: { categoryId: input.categoryId } },
              body: input.body,
            }),
          ),
    onSuccess: () => invalidate(client, adminKeys.skillCategories),
  });
}

export function useDeleteSkill() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await api.DELETE('/api/admin/skills/{id}', { params: { path: { id } } });
      if (result.error) throw new Error(apiErrorMessage(result.error) ?? 'No se pudo borrar');
    },
    onSuccess: () => invalidate(client, adminKeys.skillCategories),
  });
}

// ── Perfiles curados ────────────────────────────────────────────────────────
export function useCuratedProfilesAdmin() {
  return useQuery({
    queryKey: adminKeys.curatedProfiles,
    queryFn: async (): Promise<AdminCuratedProfile[]> =>
      unwrap(await api.GET('/api/admin/curated-profiles')),
  });
}

export function useSaveCuratedProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      input:
        | { id: string; body: UpdateCuratedProfileBody }
        | { id?: undefined; body: CreateCuratedProfileBody },
    ) =>
      input.id !== undefined
        ? unwrap(
            await api.PATCH('/api/admin/curated-profiles/{id}', {
              params: { path: { id: input.id } },
              body: input.body,
            }),
          )
        : unwrap(
            await api.POST('/api/admin/curated-profiles', {
              body: input.body,
            }),
          ),
    onSuccess: () => invalidate(client, adminKeys.curatedProfiles),
  });
}

export function useDeleteCuratedProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await api.DELETE('/api/admin/curated-profiles/{id}', {
        params: { path: { id } },
      });
      if (result.error) throw new Error(apiErrorMessage(result.error) ?? 'No se pudo borrar');
    },
    onSuccess: () => invalidate(client, adminKeys.curatedProfiles),
  });
}

/** Duplicar (add-curated-profile-lifecycle): la copia nace PRIVATE y no enumerada. */
export function useDuplicateCuratedProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<AdminCuratedProfile> =>
      unwrap(
        await api.POST('/api/admin/curated-profiles/{id}/duplicate', {
          params: { path: { id } },
          body: {},
        }),
      ),
    onSuccess: () => invalidate(client, adminKeys.curatedProfiles),
  });
}

/** Archivar o desarchivar: la fecha la pone el servidor, nunca el panel. */
export function useArchiveCuratedProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; archive: boolean }): Promise<AdminCuratedProfile> =>
      input.archive
        ? unwrap(
            await api.POST('/api/admin/curated-profiles/{id}/archive', {
              params: { path: { id: input.id } },
            }),
          )
        : unwrap(
            await api.POST('/api/admin/curated-profiles/{id}/unarchive', {
              params: { path: { id: input.id } },
            }),
          ),
    onSuccess: () => invalidate(client, adminKeys.curatedProfiles),
  });
}

// ── Temas y analítica ───────────────────────────────────────────────────────
export function useThemes() {
  return useQuery({
    queryKey: adminKeys.themes,
    queryFn: async (): Promise<AdminTheme[]> => unwrap(await api.GET('/api/admin/themes')),
    staleTime: 30 * 60 * 1000,
  });
}

export function useAnalytics(from: string, to: string) {
  return useQuery({
    queryKey: adminKeys.analytics(from, to),
    queryFn: async (): Promise<ProfileViews> =>
      unwrap(await api.GET('/api/admin/analytics/views', { params: { query: { from, to } } })),
  });
}

// ── Revisión del CV (add-cv-consistency-rules) ─────────────────────────────
/**
 * Hallazgos de consistencia. Con `staleTime: 0` y `refetchOnMount: 'always'` se vuelve a pedir cada
 * vez que se entra a la pantalla, porque el resultado depende de lo último que se editó.
 */
export function useCvConsistency() {
  return useQuery({
    queryKey: adminKeys.consistency,
    // El panel está en español: sin locale el backend usaría el Accept-Language del navegador.
    queryFn: async (): Promise<CvConsistency> =>
      unwrap(await api.GET('/api/admin/consistency', { params: { query: { locale: 'es' } } })),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

// ── Enlaces de seguimiento (add-share-links) ────────────────────────────────
/** Enlaces del perfil con sus aperturas; `undefined` (perfil sin guardar) no llama a la API. */
export function useShareLinks(profileId: string | undefined) {
  return useQuery({
    queryKey: adminKeys.shareLinks(profileId ?? ''),
    queryFn: async (): Promise<ShareLink[]> =>
      unwrap(
        await api.GET('/api/admin/curated-profiles/{id}/share-links', {
          params: { path: { id: profileId ?? '' } },
        }),
      ),
    enabled: profileId !== undefined,
  });
}

export function useCreateShareLink(profileId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateShareLinkBody): Promise<ShareLink> =>
      unwrap(
        await api.POST('/api/admin/curated-profiles/{id}/share-links', {
          params: { path: { id: profileId } },
          body,
        }),
      ),
    onSuccess: () => invalidate(client, adminKeys.shareLinks(profileId)),
  });
}

export function useRenameShareLink(profileId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { linkId: string; label: string }): Promise<ShareLink> =>
      unwrap(
        await api.PATCH('/api/admin/curated-profiles/{id}/share-links/{linkId}', {
          params: { path: { id: profileId, linkId: input.linkId } },
          body: { label: input.label },
        }),
      ),
    onSuccess: () => invalidate(client, adminKeys.shareLinks(profileId)),
  });
}

export function useRevokeShareLink(profileId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (linkId: string): Promise<ShareLink> =>
      unwrap(
        await api.POST('/api/admin/curated-profiles/{id}/share-links/{linkId}/revoke', {
          params: { path: { id: profileId, linkId } },
        }),
      ),
    onSuccess: () => invalidate(client, adminKeys.shareLinks(profileId)),
  });
}

/** El enlace `LINKEDIN_POST` activo del perfil (lo crea si no hay); 409 si no es público. */
export function useLinkedInShareLink(profileId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<ShareLink> =>
      unwrap(
        await api.POST('/api/admin/curated-profiles/{id}/share-links/linkedin', {
          params: { path: { id: profileId } },
        }),
      ),
    onSuccess: () => invalidate(client, adminKeys.shareLinks(profileId)),
  });
}
