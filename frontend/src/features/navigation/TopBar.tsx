import { Link } from 'react-router';
import { PrintButton } from '@/features/curated-view/print/PrintButton';
import { useLocale } from '@/shared/i18n/use-locale';
import { useProfileLink } from '@/shared/lib/profile-link';
import type { LayoutName } from '@/themes/layouts';
import { DeferredMenu } from './DeferredMenu';
import { LazyProfileMenu, LazyThemeSwitcher } from './lazy-menus';
import { LayoutSwitcher } from './LayoutSwitcher';
import { LocaleSwitcher } from './LocaleSwitcher';
import { MobileMenuTrigger, ProfilesTrigger, ThemeTrigger } from './menu-triggers';

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
  /**
   * Los menús (tema y perfiles) cargan en diferido: `true` cuando la vista terminó de revelarse
   * o llegó a un estado terminal, momento en que se traen en un instante ocioso (D3 de
   * `improve-mobile-performance`). Antes, solo ante la intención del visitante sobre el disparador.
   */
  menusReady?: boolean;
}

export function TopBar({
  activeSlug,
  brand,
  layout,
  showProfileMenu = false,
  onPrint,
  menusReady = true,
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
          {showProfileMenu && (
            <DeferredMenu
              id="profiles"
              menu={LazyProfileMenu}
              menuProps={{ activeSlug }}
              ready={menusReady}
              placeholder={(bind) => (
                <>
                  <div className="hidden md:block">
                    <ProfilesTrigger
                      aria-haspopup="menu"
                      aria-expanded={false}
                      {...bind('desktop')}
                    />
                  </div>
                  <div className="md:hidden">
                    <MobileMenuTrigger
                      aria-haspopup="dialog"
                      aria-expanded={false}
                      {...bind('mobile')}
                    />
                  </div>
                </>
              )}
            />
          )}
          <LayoutSwitcher current={layout} />
          <DeferredMenu
            id="theme"
            menu={LazyThemeSwitcher}
            menuProps={{}}
            ready={menusReady}
            placeholder={(bind) => (
              <ThemeTrigger aria-haspopup="menu" aria-expanded={false} {...bind('theme')} />
            )}
          />
          <LocaleSwitcher />
          {onPrint && <PrintButton onPrint={onPrint} />}
        </div>
      </div>
    </header>
  );
}
