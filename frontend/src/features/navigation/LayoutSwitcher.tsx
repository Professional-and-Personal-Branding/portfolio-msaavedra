import { LayoutTemplate, PanelLeft } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useLocale } from '@/shared/i18n/use-locale';
import { useUrlState } from '@/shared/lib/url-state';
import { LAYOUT_NAMES, type LayoutName } from '@/themes/layouts';

interface LayoutSwitcherProps {
  /** Layout efectivo (URL o perfil). */
  current: LayoutName;
}

const ICONS = { classic: LayoutTemplate, sidebar: PanelLeft } as const;
const LABELS = { classic: 'layout.classic', sidebar: 'layout.sidebar' } as const;

/** Conmuta `?layout=` entre los layouts registrados (spec `layout-engine`). */
export function LayoutSwitcher({ current }: LayoutSwitcherProps) {
  const { t } = useLocale();
  const [, setUrl] = useUrlState();

  return (
    <div role="group" aria-label={t('nav.layout')} className="hidden items-center gap-1 sm:flex">
      {LAYOUT_NAMES.map((name) => {
        const Icon = ICONS[name];
        const active = name === current;
        return (
          <Button
            key={name}
            variant={active ? 'default' : 'outline'}
            size="icon-sm"
            aria-pressed={active}
            aria-label={t(LABELS[name])}
            title={t(LABELS[name])}
            onClick={() => setUrl({ layout: name })}
          >
            <Icon aria-hidden />
          </Button>
        );
      })}
    </div>
  );
}
