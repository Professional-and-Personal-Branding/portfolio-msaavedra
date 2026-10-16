import { ChevronDown, Menu, Palette } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Button } from '@/shared/components/ui/button';
import { useLocale } from '@/shared/i18n/use-locale';

type TriggerProps = Omit<
  ComponentProps<typeof Button>,
  'variant' | 'size' | 'children' | 'aria-label' | 'title'
>;

/**
 * Los disparadores de los menús de la barra. Los usan por igual el menú real (dentro de
 * `DropdownMenuTrigger`/`SheetTrigger asChild`) y el provisional que muestra `DeferredMenu`
 * mientras el módulo del menú no llegó: un solo marcado garantiza que clases, ícono, texto,
 * `aria-label` y `title` no diverjan (D3 de `improve-mobile-performance`).
 */
export function ThemeTrigger(props: TriggerProps) {
  const { t } = useLocale();
  return (
    <Button
      variant="outline"
      size="icon-sm"
      aria-label={t('nav.theme')}
      title={t('nav.theme')}
      {...props}
    >
      <Palette aria-hidden />
    </Button>
  );
}

/** Disparador del menú de perfiles en escritorio. */
export function ProfilesTrigger(props: TriggerProps) {
  const { t } = useLocale();
  return (
    <Button variant="outline" size="sm" {...props}>
      {t('nav.profiles')}
      <ChevronDown aria-hidden />
    </Button>
  );
}

/** Disparador del panel de perfiles en móvil. */
export function MobileMenuTrigger(props: TriggerProps) {
  const { t } = useLocale();
  return (
    <Button variant="outline" size="icon-sm" aria-label={t('nav.menu')} {...props}>
      <Menu aria-hidden />
    </Button>
  );
}
