import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { isHttpError } from '@/shared/lib/api-client';

/** Clave de la sesión del backoffice; se invalida ante cualquier 401 (spec `admin-backoffice-shell`). */
export const SESSION_QUERY_KEY = ['auth', 'me'] as const;

function isSessionQuery(queryKey: readonly unknown[] | undefined): boolean {
  return queryKey?.[0] === SESSION_QUERY_KEY[0] && queryKey[1] === SESSION_QUERY_KEY[1];
}

export function createQueryClient(): QueryClient {
  // La caché avisa del 401 antes de que exista el cliente: se resuelve al vuelo.
  const holder: { client?: QueryClient } = {};

  /**
   * Un 401 en cualquier consulta significa que la sesión ya no vale: se
   * invalida para que `RequireSession` mande al login. La propia consulta de
   * sesión queda excluida, porque invalidarla al fallar la haría reintentar
   * en bucle.
   */
  const onError = (error: unknown, queryKey?: readonly unknown[]): void => {
    if (isHttpError(error, 401) && !isSessionQuery(queryKey)) {
      void holder.client?.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    }
  };

  holder.client = new QueryClient({
    queryCache: new QueryCache({ onError: (error, query) => onError(error, query.queryKey) }),
    mutationCache: new MutationCache({ onError: (error) => onError(error) }),
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
