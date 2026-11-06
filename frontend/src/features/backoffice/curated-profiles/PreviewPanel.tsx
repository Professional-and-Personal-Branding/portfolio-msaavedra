import { RefreshCw } from 'lucide-react';
import { useId } from 'react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import type { Locale } from '@/shared/i18n/locale';
import { formatCount } from '@/shared/i18n/plural';
import type { CuratedProfile } from '@/shared/types/portfolio';
import { ProfileLayout } from '@/themes/layouts/ProfileLayout';
import { renderableSections } from '@/themes/layouts/sections';
import { ThemeProvider } from '@/themes/theme-provider';
import type { ThemeTokens } from '@/themes/tokens';
import { PreviewLocaleTabs } from '../shared/PreviewLocaleTabs';
import { previewTabId } from '../shared/preview-tab-id';

interface PreviewPanelProps {
  data: CuratedProfile | undefined;
  tokens: ThemeTokens;
  layout: string;
  isFetching: boolean;
  error: Error | null;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}

/**
 * Preview del borrador con los mismos componentes que la vista pública
 * (spec `curated-profile-builder`). El tema se aplica en el cliente, así que
 * cambiar un color no vuelve a pedir los datos.
 */
export function PreviewPanel({
  data,
  tokens,
  layout,
  isFetching,
  error,
  locale,
  onLocaleChange,
}: PreviewPanelProps) {
  const panelId = useId();
  return (
    <section aria-label="Vista previa" className="flex flex-col gap-3">
      <header className="flex items-center gap-2">
        <h2 className="font-semibold">Vista previa</h2>
        {isFetching && (
          <span className="flex items-center gap-1 text-xs text-text-dim" role="status">
            <RefreshCw className="size-3 animate-spin" aria-hidden />
            actualizando
          </span>
        )}
        <PreviewLocaleTabs locale={locale} onLocaleChange={onLocaleChange} panelId={panelId} />
        {data && (
          <p className="ml-auto text-xs text-text-dim" data-testid="preview-counts">
            {formatCount(data.experiences.length, { one: 'experiencia', other: 'experiencias' })} ·{' '}
            {formatCount(data.skillCategories.length, { one: 'categoría', other: 'categorías' })} ·{' '}
            {formatCount(data.projects.length, { one: 'proyecto', other: 'proyectos' })}
          </p>
        )}
      </header>

      {error && (
        <p role="alert" className="surface px-4 py-3 text-sm text-destructive">
          No se pudo generar la vista previa: {error.message}
        </p>
      )}

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={previewTabId(panelId, locale)}
        className="overflow-hidden rounded-theme border border-border"
      >
        {data ? (
          <ThemeProvider profileTokens={tokens}>
            <div
              data-testid="preview-canvas"
              className="max-h-[70vh] overflow-y-auto overflow-x-hidden"
            >
              <ProfileLayout
                name={layout}
                data={data}
                sections={renderableSections(data.sections)}
              />
            </div>
          </ThemeProvider>
        ) : (
          <div className="flex flex-col gap-3 p-6">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
      </div>
    </section>
  );
}
