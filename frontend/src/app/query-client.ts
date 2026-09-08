import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { isHttpError } from '@/shared/lib/api-client';

/** Clave de la sesión del backoffice; se invalida ante cualquier 401 (spec `admin-backoffice-shell`). */
export const SESSION_QUERY_KEY = ['auth', 'me'] as const;

export function createQueryClient(): QueryClient {
  // La caché avisa del 401 antes de que exista el cliente: se resuelve al vuelo.
  const holder: { client?: QueryClient } = {};

  const onError = (error: unknown): void => {
    if (isHttpError(error, 401)) {
      void holder.client?.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    }
  };

  holder.client = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        retry: (failureCount, error) => {
          // 401/404 son respuestas de negocio (sesión / no existe): no reintentar.
          if (isHttpError(error, 401) || isHttpError(error, 404)) return false;
          return failureCount < 1;
        },
        refetchOnWindowFocus: false,
      },
    },
  });
  return holder.client;
}
