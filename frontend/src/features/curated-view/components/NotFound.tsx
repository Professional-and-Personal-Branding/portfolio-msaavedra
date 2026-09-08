import { Home } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/shared/components/ui/button';
import { useLocale } from '@/shared/i18n/use-locale';
import { useProfileLink } from '@/shared/lib/profile-link';

export function NotFound() {
  const { t } = useLocale();
  const home = useProfileLink('all');
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-6 py-section text-center">
      <p className="mb-3 text-6xl font-extrabold text-gradient">404</p>
      <h1 className="mb-2 text-2xl font-bold">{t('notFound.title')}</h1>
      <p className="mb-6 text-text-muted">{t('notFound.description')}</p>
      <Button asChild>
        <Link to={home}>
          <Home aria-hidden />
          {t('notFound.home')}
        </Link>
      </Button>
    </div>
  );
}
