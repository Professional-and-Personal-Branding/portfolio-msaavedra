import { Link } from 'react-router';
import { PrintButton } from '@/features/curated-view/print/PrintButton';
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
  /** Acción de imprimir; solo con el perfil resuelto (decisión D9 de `add-printable-one-page`). */
  onPrint?: () => void;
}

export function TopBar({
  activeSlug,
  brand,
  layout,
  showProfileMenu = false,
  onPrint,
}: TopBarProps) {
  const { t } = useLocale();
  const home = useProfileLink('all');
  return (
    <header className="sticky top-0 z-40 border-b border-border glass print:hidden">
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
          {onPrint && <PrintButton onPrint={onPrint} />}
        </div>
      </div>
    </header>
  );
}
