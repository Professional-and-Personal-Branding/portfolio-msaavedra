import { LOCALES } from '@/shared/i18n/locale';
import { useLocale } from '@/shared/i18n/use-locale';
import { cn } from '@/shared/lib/utils';

/** ES / EN: escribe `?lang=` sin recargar (spec `frontend-localization`). */
export function LocaleSwitcher() {
  const { locale, setLocale, t } = useLocale();
  return (
    <div
      role="group"
      aria-label={t('nav.language')}
      className="flex items-center overflow-hidden rounded-theme-sm border border-border text-xs font-semibold"
    >
      {LOCALES.map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={item === locale}
          onClick={() => setLocale(item)}
          className={cn(
            'px-2.5 py-1.5 uppercase transition-colors',
            item === locale ? 'bg-brand text-brand-foreground' : 'text-text-muted hover:text-text',
          )}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
