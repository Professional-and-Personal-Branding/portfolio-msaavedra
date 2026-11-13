import { useMutation, useQuery, useQueryClient, type MutateOptions } from '@tanstack/react-query';

interface SaveCredentialInput {
  provider: string;
  secret: string;
}
import { api, apiErrorMessage, HttpError, unwrap } from '@/shared/lib/api-client';
import type {
  EnqueueSyncResult,
  IntegrationsOverview,
  IntegrationStatus,
} from '../shared/admin-types';
import { adminKeys, invalidate } from '../shared/use-admin-api';

/** Cada cuánto se refresca el estado mientras haya trabajos pendientes o en curso. */
export const INTEGRATIONS_REFRESH_MS = 15_000;

/** ¿Algún proveedor tiene trabajos esperando o corriendo? Solo entonces conviene refrescar. */
export function hasActiveJobs(data: IntegrationsOverview | undefined): boolean {
  return (data?.providers ?? []).some((p) => p.jobs.pending > 0 || p.jobs.running > 0);
}

/**
 * Estado de las integraciones. Con `poll` refresca cada 15 s, pero solo mientras haya trabajos
 * `pending` o `running`: sin ellos no hay nada que esperar y no se consulta (D19).
 */
export function useIntegrations(options: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: adminKeys.integrations,
    queryFn: async (): Promise<IntegrationsOverview> =>
      unwrap(await api.GET('/api/admin/integrations')),
    refetchInterval: options.poll
      ? (query) => (hasActiveJobs(query.state.data) ? INTEGRATIONS_REFRESH_MS : false)
      : false,
  });
}

export function useSyncIntegration() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (provider: string): Promise<EnqueueSyncResult> =>
      unwrap(
        await api.POST('/api/admin/integrations/{provider}/sync', {
          params: { path: { provider } },
        }),
      ),
    onSuccess: () => invalidate(client, adminKeys.integrations),
  });
}

export function useSetIntegrationEnabled() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { provider: string; enabled: boolean }): Promise<IntegrationStatus> =>
      unwrap(
        await api.PATCH('/api/admin/integrations/{provider}', {
          params: { path: { provider: input.provider } },
          body: { enabled: input.enabled },
        }),
      ),
    onSuccess: () => invalidate(client, adminKeys.integrations),
  });
}

/**
 * Guardar la credencial. El secreto viaja en `variables` de la mutación: con `gcTime: 0` y un `reset()` al
 * terminar (también si falla) no queda en la caché de TanStack Query ni en el estado del hook (B3).
 */
export function useSaveCredential() {
  const client = useQueryClient();
  const mutation = useMutation({
    gcTime: 0,
    mutationFn: async (input: SaveCredentialInput): Promise<void> => {
      const result = await api.PUT('/api/admin/integrations/{provider}/credential', {
        params: { path: { provider: input.provider } },
        body: { secret: input.secret },
      });
      if (result.error) {
        throw new HttpError(
          result.response.status,
          apiErrorMessage(result.error) ?? 'No se pudo guardar',
        );
      }
    },
    onSuccess: () => invalidate(client, adminKeys.integrations),
  });
  const { mutate, reset } = mutation;
  return {
    ...mutation,
    mutate: (
      input: SaveCredentialInput,
      options?: MutateOptions<void, Error, SaveCredentialInput>,
    ) =>
      mutate(input, {
        ...options,
        onSettled: (...args) => {
          options?.onSettled?.(...args);
          reset();
        },
      }),
  };
}

export function useDeleteCredential() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (provider: string): Promise<void> => {
      const result = await api.DELETE('/api/admin/integrations/{provider}/credential', {
        params: { path: { provider } },
      });
      if (result.error) {
        throw new HttpError(
          result.response.status,
          apiErrorMessage(result.error) ?? 'No se pudo borrar',
        );
      }
    },
    onSuccess: () => invalidate(client, adminKeys.integrations),
  });
}
