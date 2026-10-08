import { RefreshCw } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import type { Locale } from '@/shared/i18n/locale';
import type { CuratedProfile } from '@/shared/types/portfolio';
import { ProfileLayout } from '@/themes/layouts/ProfileLayout';
import { renderableSections } from '@/themes/layouts/sections';
import { ThemeProvider } from '@/themes/theme-provider';
import type { ThemeTokens } from '@/themes/tokens';

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
        <Tabs value={locale} onValueChange={(next) => onLocaleChange(next as Locale)}>
          <TabsList aria-label="Idioma de la vista previa" className="h-7">
            <TabsTrigger value="es" className="px-2 py-0.5 text-xs uppercase">
              es
            </TabsTrigger>
            <TabsTrigger value="en" className="px-2 py-0.5 text-xs uppercase">
              en
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {data && (
          <p className="ml-auto text-xs text-text-dim" data-testid="preview-counts">
            {data.experiences.length} experiencias · {data.skillCategories.length} categorías ·{' '}
            {data.projects.length} proyectos
          </p>
        )}
      </header>

      {error && (
        <p role="alert" className="surface px-4 py-3 text-sm text-destructive">
          No se pudo generar la vista previa: {error.message}
        </p>
      )}

      <div className="overflow-hidden rounded-theme border border-border">
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
