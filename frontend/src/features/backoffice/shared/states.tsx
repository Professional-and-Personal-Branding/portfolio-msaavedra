import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="font-semibold">{title}</p>
      {description && <p className="max-w-md text-sm text-text-muted">{description}</p>}
      {action}
    </div>
  );
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Cargando" className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

export function ErrorPanel({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div role="alert" className="surface flex flex-col items-center gap-3 px-6 py-10 text-center">
      <p className="font-semibold">No pudimos cargar los datos</p>
      {message && <p className="max-w-md text-sm text-text-muted">{message}</p>}
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw aria-hidden />
        Reintentar
      </Button>
    </div>
  );
}
