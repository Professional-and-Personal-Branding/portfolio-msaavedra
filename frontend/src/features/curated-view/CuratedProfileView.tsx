import { useEffect } from 'react';
import { TopBar } from '@/features/navigation/TopBar';
import { Footer } from '@/shared/components/portfolio/Footer';
import { useLocale } from '@/shared/i18n/use-locale';
import {
  applyDocumentMeta,
  metaFromProfile,
  restoreDocumentMeta,
} from '@/shared/lib/document-meta';
import { useUrlState } from '@/shared/lib/url-state';
import { resolveLayoutName } from '@/themes/layouts';
import { ProfileLayout } from '@/themes/layouts/ProfileLayout';
import { renderableSections } from '@/themes/layouts/sections';
import { ThemeProvider } from '@/themes/theme-provider';
import { AccessTokenForm } from './components/AccessTokenForm';
import { ErrorState } from './components/ErrorState';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { NotFound } from './components/NotFound';
import { useCuratedProfile } from './hooks/use-curated-profile';

interface CuratedProfileViewProps {
  slug: string;
}

/** Orquesta URL → locale/tema/layout/token → API → layout con secciones (decisión D7). */
export function CuratedProfileView({ slug }: CuratedProfileViewProps) {
  const [url, setUrl] = useUrlState();
  const { locale } = useLocale();
  const state = useCuratedProfile(slug, { locale, token: url.token });
  const data = state.status === 'success' ? state.data : null;

  const layoutName = resolveLayoutName(url.layout ?? data?.layout);

  // Metadatos para buscadores y para las vistas previas de los links (spec `public-seo`).
  useEffect(() => {
    if (!data) return;
    applyDocumentMeta(metaFromProfile(data, locale, globalThis.location?.origin ?? ''));
    return () => restoreDocumentMeta();
  }, [data, locale]);

  let content;
  switch (state.status) {
    case 'loading':
      content = <LoadingSkeleton />;
      break;
    case 'needsToken':
      content = (
        <AccessTokenForm invalid={state.invalidToken} onSubmit={(token) => setUrl({ token })} />
      );
      break;
    case 'notFound':
      content = <NotFound />;
      break;
    case 'error':
      content = <ErrorState onRetry={state.retry} />;
      break;
    case 'success':
      content = (
        <ProfileLayout
          name={layoutName}
          data={state.data}
          sections={renderableSections(state.data.sections)}
        />
      );
      break;
  }

  return (
    <ThemeProvider profileTokens={data?.theme?.tokens ?? null} presetSlug={url.theme}>
      <div className="relative flex min-h-screen flex-col">
        <div aria-hidden className="pointer-events-none fixed inset-0 bg-glow" />
        <div className="relative z-10 flex flex-1 flex-col">
          <TopBar activeSlug={slug} brand={data?.profile?.fullName} layout={layoutName} />
          <main className="flex-1">{content}</main>
          <Footer name={data?.profile?.fullName} />
        </div>
      </div>
    </ThemeProvider>
  );
}
