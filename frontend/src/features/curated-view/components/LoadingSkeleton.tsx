import { Skeleton } from '@/shared/components/ui/skeleton';
import { useLocale } from '@/shared/i18n/use-locale';

export function LoadingSkeleton() {
  const { t } = useLocale();
  return (
    <div
      role="status"
      aria-label={t('loading')}
      className="mx-auto w-full max-w-(--t-max-width) px-6 pt-16 pb-section"
    >
      <Skeleton className="mb-6 h-7 w-40 rounded-full" />
      <Skeleton className="mb-4 h-14 w-3/4 max-w-xl" />
      <Skeleton className="mb-3 h-7 w-1/2 max-w-md" />
      <Skeleton className="mb-10 h-20 w-full max-w-2xl" />
      <div className="mb-14 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-theme" />
        ))}
      </div>
      <Skeleton className="mb-6 h-9 w-72" />
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="mb-4 h-36 rounded-theme" />
      ))}
      <span className="sr-only">{t('loading')}</span>
    </div>
  );
}
