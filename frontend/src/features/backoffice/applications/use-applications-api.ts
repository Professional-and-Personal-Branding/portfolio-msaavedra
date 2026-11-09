import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage, unwrap } from '@/shared/lib/api-client';
import type {
  Application,
  ApplicationStatus,
  ApplicationSummary,
  CreateApplicationBody,
  UpdateApplicationBody,
} from '../shared/admin-types';
import { adminKeys, invalidate } from '../shared/use-admin-api';
import { statusQuery } from './application-status';

/** Lista filtrada por estados; `undefined` trae todas. */
export function useApplications(statuses: readonly ApplicationStatus[] | undefined) {
  const status = statusQuery(statuses);
  return useQuery({
    queryKey: adminKeys.applicationList(status ?? 'todas'),
    queryFn: async (): Promise<Application[]> =>
      unwrap(
        await api.GET('/api/admin/applications', {
          params: { query: status ? { status } : {} },
        }),
      ),
  });
}

/** Conteo por estado de hoy (no depende de ningún rango de fechas). */
export function useApplicationSummary() {
  return useQuery({
    queryKey: adminKeys.applicationSummary,
    queryFn: async (): Promise<ApplicationSummary> =>
      unwrap(await api.GET('/api/admin/applications/summary')),
  });
}

export function useSaveApplication() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      input:
        | { id: string; body: UpdateApplicationBody }
        | { id?: undefined; body: CreateApplicationBody },
    ): Promise<Application> =>
      input.id !== undefined
        ? unwrap(
            await api.PATCH('/api/admin/applications/{id}', {
              params: { path: { id: input.id } },
              body: input.body,
            }),
          )
        : unwrap(await api.POST('/api/admin/applications', { body: input.body })),
    onSuccess: () => invalidate(client, adminKeys.applications),
  });
}

export function useDeleteApplication() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await api.DELETE('/api/admin/applications/{id}', {
        params: { path: { id } },
      });
      if (result.error) throw new Error(apiErrorMessage(result.error) ?? 'No se pudo borrar');
    },
    onSuccess: () => invalidate(client, adminKeys.applications),
  });
}
