import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useCallback } from 'react';
import { SESSION_QUERY_KEY } from '@/app/query-client';
import { api, unwrap } from '@/shared/lib/api-client';
import type { components } from '@/shared/types/api';

export type Admin = components['schemas']['AdminResponse'];

export interface Credentials {
  email: string;
  password: string;
}

/**
 * Estado de sesión del backoffice: se deriva de `GET /api/auth/me`, nunca de
 * un token guardado en el cliente (spec `admin-backoffice-shell`).
 */
export function useSession(): UseQueryResult<Admin> {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async () => unwrap(await api.GET('/api/auth/me')),
    retry: false,
    staleTime: 60_000,
    gcTime: 0,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (credentials: Credentials) =>
      unwrap(await api.POST('/api/auth/login', { body: credentials })),
    onSuccess: (data) => {
      // La cookie ya está puesta: sembramos el usuario para no pedir /me otra vez.
      queryClient.setQueryData(SESSION_QUERY_KEY, data.user);
    },
  });
}

export function useLogout(): { logout: () => Promise<void>; isPending: boolean } {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      await api.POST('/api/auth/logout');
    },
    onSettled: () => {
      // Aunque el logout falle, en el cliente la sesión se descarta.
      // `resetQueries` (y no `clear`) porque además de vaciar la caché avisa a
      // los componentes montados, que vuelven a preguntar por la sesión.
      void queryClient.resetQueries();
    },
  });

  const logout = useCallback(async () => {
    await mutation.mutateAsync().catch(() => undefined);
  }, [mutation]);

  return { logout, isPending: mutation.isPending };
}
