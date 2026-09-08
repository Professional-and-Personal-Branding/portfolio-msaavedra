import { RefreshCw } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useLocale } from '@/shared/i18n/use-locale';

interface ErrorStateProps {
  onRetry: () => void;
}

export function ErrorState({ onRetry }: ErrorStateProps) {
  const { t } = useLocale();
  return (
    <div
      role="alert"
      className="mx-auto flex w-full max-w-md flex-col items-center px-6 py-section text-center"
    >
      <h1 className="mb-2 text-2xl font-bold">{t('error.title')}</h1>
      <p className="mb-6 text-text-muted">{t('error.description')}</p>
      <Button onClick={onRetry} variant="outline">
        <RefreshCw aria-hidden />
        {t('error.retry')}
      </Button>
    </div>
  );
}
