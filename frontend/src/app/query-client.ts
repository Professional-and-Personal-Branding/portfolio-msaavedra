import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        retry: (failureCount, error) => {
          // 401/404 son respuestas de negocio (token / no existe): no reintentar.
          if (error instanceof Error && 'status' in error) {
            const status = (error as { status?: number }).status;
            if (status === 401 || status === 404) return false;
          }
          return failureCount < 1;
        },
        refetchOnWindowFocus: false,
      },
    },
  });
}
