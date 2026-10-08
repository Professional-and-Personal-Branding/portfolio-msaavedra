import { Link } from 'react-router';
import { useLocale } from '@/shared/i18n/use-locale';
import { useProfileLink } from '@/shared/lib/profile-link';
import type { LayoutName } from '@/themes/layouts';
import { LayoutSwitcher } from './LayoutSwitcher';
import { LocaleSwitcher } from './LocaleSwitcher';
import { ProfileMenu } from './ProfileMenu';
import { ThemeSwitcher } from './ThemeSwitcher';

interface TopBarProps {
  activeSlug: string;
  /** Nombre del perfil base (marca de la barra). */
  brand?: string | null;
  layout: LayoutName;
  /**
   * Menú de otros perfiles: solo en la home. Un perfil abierto por su link no
   * ofrece navegación a los demás (spec `public-portfolio-frontend`).
   */
  showProfileMenu?: boolean;
}

export function TopBar({ activeSlug, brand, layout, showProfileMenu = false }: TopBarProps) {
  const { t } = useLocale();
  const home = useProfileLink('all');
  return (
    <header className="sticky top-0 z-40 border-b border-border glass">
      <div className="mx-auto flex w-full max-w-(--t-max-width) items-center gap-2 px-4 py-3 md:px-6">
        <Link
          to={home}
          className="truncate font-heading text-sm font-bold tracking-tight md:text-base"
        >
          {brand ?? t('app.title')}
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {showProfileMenu && <ProfileMenu activeSlug={activeSlug} />}
          <LayoutSwitcher current={layout} />
          <ThemeSwitcher />
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  );
}
