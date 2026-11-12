import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage, HttpError, unwrap } from '@/shared/lib/api-client';
import type {
  AdminCuratedProfile,
  CreateFromJobPostingBody,
  ImportJobPostingBody,
  JobPosting,
  JobPostingSuggestion,
} from '../shared/admin-types';
import { adminKeys, invalidate } from '../shared/use-admin-api';

export function useJobPostings() {
  return useQuery({
    queryKey: adminKeys.jobPostings,
    queryFn: async (): Promise<JobPosting[]> => unwrap(await api.GET('/api/admin/job-postings')),
  });
}

export function useJobPosting(id: string | null) {
  return useQuery({
    queryKey: adminKeys.jobPosting(id ?? ''),
    enabled: id !== null,
    retry: false,
    queryFn: async (): Promise<JobPosting> =>
      unwrap(await api.GET('/api/admin/job-postings/{id}', { params: { path: { id: id ?? '' } } })),
  });
}

/** Se calcula en cada lectura contra el vocabulario vigente: no se deja en caché. */
export function useJobPostingSuggestion(id: string | null) {
  return useQuery({
    queryKey: adminKeys.jobPostingSuggestion(id ?? ''),
    enabled: id !== null,
    retry: false,
    gcTime: 0,
    queryFn: async (): Promise<JobPostingSuggestion> =>
      unwrap(
        await api.GET('/api/admin/job-postings/{id}/suggestion', {
          params: { path: { id: id ?? '' } },
        }),
      ),
  });
}

export interface ImportResult {
  posting: JobPosting;
  /** 201 = nueva; 200 = ya existía y se actualizó. */
  created: boolean;
}

export function useImportJobPosting() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: ImportJobPostingBody): Promise<ImportResult> => {
      const result = await api.POST('/api/admin/job-postings', { body });
      if (result.data === undefined) {
        throw new HttpError(
          result.response.status,
          apiErrorMessage(result.error) ?? result.response.statusText,
        );
      }
      return { posting: result.data, created: result.response.status === 201 };
    },
    onSuccess: () => invalidate(client, adminKeys.jobPostings),
  });
}

export function useDeleteJobPosting() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await api.DELETE('/api/admin/job-postings/{id}', {
        params: { path: { id } },
      });
      if (result.error) {
        throw new HttpError(
          result.response.status,
          apiErrorMessage(result.error) ?? 'No se pudo borrar',
        );
      }
    },
    onSuccess: () => invalidate(client, adminKeys.jobPostings),
  });
}

export function useCreateDraftFromJobPosting() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateFromJobPostingBody): Promise<AdminCuratedProfile> =>
      unwrap(await api.POST('/api/admin/curated-profiles/from-job-posting', { body })),
    onSuccess: () => invalidate(client, adminKeys.curatedProfiles),
  });
}
