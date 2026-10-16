import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { createQueryClient } from './query-client';

interface AppProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

/** Providers sin router: la app monta un data router (`createBrowserRouter`), los tests uno en memoria. */
export function AppProviders({ children, queryClient }: AppProvidersProps) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
