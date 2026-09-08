import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useSession } from './use-session';

/**
 * Puerta de las rutas `/admin/*`: mientras se comprueba la sesión muestra un
 * esqueleto; sin sesión redirige al login recordando el destino
 * (spec `admin-backoffice-shell`).
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const { data, isPending } = useSession();
  const location = useLocation();

  if (isPending) {
    return (
      <div role="status" aria-label="Comprobando sesión" className="space-y-4 p-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!data) {
    const to = `${location.pathname}${location.search}`;
    return <Navigate to="/admin/login" state={{ from: to }} replace />;
  }

  return <>{children}</>;
}
