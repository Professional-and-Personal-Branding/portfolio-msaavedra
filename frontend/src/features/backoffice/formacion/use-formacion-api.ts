import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage, unwrap } from '@/shared/lib/api-client';
import type {
  AdminCertification,
  AdminEducation,
  CreateCertificationBody,
  CreateEducationBody,
  UpdateCertificationBody,
  UpdateEducationBody,
} from '../shared/admin-types';
import { adminKeys, invalidate } from '../shared/use-admin-api';

// ── Educación ───────────────────────────────────────────────────────────────
export function useEducation() {
  return useQuery({
    queryKey: adminKeys.education,
    queryFn: async (): Promise<AdminEducation[]> => unwrap(await api.GET('/api/admin/education')),
  });
}

export function useSaveEducation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; body: CreateEducationBody | UpdateEducationBody }) =>
      input.id
        ? unwrap(
            await api.PATCH('/api/admin/education/{id}', {
              params: { path: { id: input.id } },
              body: input.body as UpdateEducationBody,
            }),
          )
        : unwrap(
            await api.POST('/api/admin/education', { body: input.body as CreateEducationBody }),
          ),
    onSuccess: () => invalidate(client, adminKeys.education),
  });
}

export function useDeleteEducation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await api.DELETE('/api/admin/education/{id}', { params: { path: { id } } });
      if (result.error) throw new Error(apiErrorMessage(result.error) ?? 'No se pudo borrar');
    },
    onSuccess: () => invalidate(client, adminKeys.education),
  });
}

// ── Certificaciones ─────────────────────────────────────────────────────────
export function useCertifications() {
  return useQuery({
    queryKey: adminKeys.certifications,
    queryFn: async (): Promise<AdminCertification[]> =>
      unwrap(await api.GET('/api/admin/certifications')),
  });
}

export function useSaveCertification() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      body: CreateCertificationBody | UpdateCertificationBody;
    }) =>
      input.id
        ? unwrap(
            await api.PATCH('/api/admin/certifications/{id}', {
              params: { path: { id: input.id } },
              body: input.body as UpdateCertificationBody,
            }),
          )
        : unwrap(
            await api.POST('/api/admin/certifications', {
              body: input.body as CreateCertificationBody,
            }),
          ),
    onSuccess: () => invalidate(client, adminKeys.certifications),
  });
}

export function useDeleteCertification() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await api.DELETE('/api/admin/certifications/{id}', {
        params: { path: { id } },
      });
      if (result.error) throw new Error(apiErrorMessage(result.error) ?? 'No se pudo borrar');
    },
    onSuccess: () => invalidate(client, adminKeys.certifications),
  });
}
