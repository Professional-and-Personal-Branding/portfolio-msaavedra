import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import type { Locale } from '@/shared/i18n/locale';
import { previewTabId } from './preview-tab-id';

const LOCALES: readonly Locale[] = ['es', 'en'];

interface PreviewLocaleTabsProps {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  /** Id del panel (`role="tabpanel"`) que muestra la vista previa en el idioma activo. */
  panelId: string;
}

/**
 * Conmutador ES/EN del idioma de una vista previa. Las dos pestañas controlan el mismo panel
 * —la vista previa, que se vuelve a resolver en el idioma elegido—, así que `aria-controls`
 * apunta a un id presente (spec `web-accessibility` § Estructura semántica válida).
 */
export function PreviewLocaleTabs({ locale, onLocaleChange, panelId }: PreviewLocaleTabsProps) {
  return (
    <Tabs value={locale} onValueChange={(next) => onLocaleChange(next as Locale)}>
      <TabsList className="h-7" aria-label="Idioma de la vista previa">
        {LOCALES.map((code) => (
          <TabsTrigger
            key={code}
            value={code}
            id={previewTabId(panelId, code)}
            aria-controls={panelId}
            className="px-2 py-0.5 text-xs uppercase"
          >
            {code}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
