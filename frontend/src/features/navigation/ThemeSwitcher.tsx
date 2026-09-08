import { Palette } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useLocale } from '@/shared/i18n/use-locale';
import { useUrlState } from '@/shared/lib/url-state';
import { THEME_PRESETS } from '@/themes/presets';
import { useTheme } from '@/themes/use-theme';

const PROFILE_THEME = '__profile__';

/** Selector de presets; el elegido se refleja en `?theme=` (spec `runtime-theming`). */
export function ThemeSwitcher() {
  const { t } = useLocale();
  const [, setUrl] = useUrlState();
  const { preset } = useTheme();
  const value = preset?.slug ?? PROFILE_THEME;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon-sm" aria-label={t('nav.theme')} title={t('nav.theme')}>
          <Palette aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{t('nav.theme')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => setUrl({ theme: next === PROFILE_THEME ? null : next })}
        >
          <DropdownMenuRadioItem value={PROFILE_THEME}>{t('theme.profile')}</DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          {THEME_PRESETS.map((item) => (
            <DropdownMenuRadioItem key={item.slug} value={item.slug} data-preset={item.slug}>
              <span
                aria-hidden
                className="mr-2 inline-block size-3 rounded-full border border-border"
                style={{ background: item.tokens.colors.accent }}
              />
              {item.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
