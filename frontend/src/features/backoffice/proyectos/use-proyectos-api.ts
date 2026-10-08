import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage, unwrap } from '@/shared/lib/api-client';
import type {
  AdminProject,
  AdminSocialLink,
  CreateProjectBody,
  CreateSocialLinkBody,
  UpdateProjectBody,
  UpdateSocialLinkBody,
} from '../shared/admin-types';
import { adminKeys, invalidate } from '../shared/use-admin-api';

// ── Proyectos destacados ────────────────────────────────────────────────────
export function useProjects() {
  return useQuery({
    queryKey: adminKeys.projects,
    queryFn: async (): Promise<AdminProject[]> => unwrap(await api.GET('/api/admin/projects')),
  });
}

export function useSaveProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; body: CreateProjectBody | UpdateProjectBody }) =>
      input.id
        ? unwrap(
            await api.PATCH('/api/admin/projects/{id}', {
              params: { path: { id: input.id } },
              body: input.body as UpdateProjectBody,
            }),
          )
        : unwrap(await api.POST('/api/admin/projects', { body: input.body as CreateProjectBody })),
    onSuccess: () => invalidate(client, adminKeys.projects),
  });
}

export function useDeleteProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await api.DELETE('/api/admin/projects/{id}', { params: { path: { id } } });
      if (result.error) throw new Error(apiErrorMessage(result.error) ?? 'No se pudo borrar');
    },
    onSuccess: () => invalidate(client, adminKeys.projects),
  });
}

// ── Enlaces sociales ────────────────────────────────────────────────────────
export function useSocialLinks() {
  return useQuery({
    queryKey: adminKeys.socialLinks,
    queryFn: async (): Promise<AdminSocialLink[]> =>
      unwrap(await api.GET('/api/admin/social-links')),
  });
}

export function useSaveSocialLink() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      body: CreateSocialLinkBody | UpdateSocialLinkBody;
    }) =>
      input.id
        ? unwrap(
            await api.PATCH('/api/admin/social-links/{id}', {
              params: { path: { id: input.id } },
              body: input.body as UpdateSocialLinkBody,
            }),
          )
        : unwrap(
            await api.POST('/api/admin/social-links', {
              body: input.body as CreateSocialLinkBody,
            }),
          ),
    onSuccess: () => invalidate(client, adminKeys.socialLinks),
  });
}

export function useDeleteSocialLink() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await api.DELETE('/api/admin/social-links/{id}', {
        params: { path: { id } },
      });
      if (result.error) throw new Error(apiErrorMessage(result.error) ?? 'No se pudo borrar');
    },
    onSuccess: () => invalidate(client, adminKeys.socialLinks),
  });
}
