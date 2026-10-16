import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { TopBar } from '@/features/navigation/TopBar';
import { Footer } from '@/shared/components/portfolio/Footer';
import { MAIN_CONTENT_ID, SkipLink } from '@/shared/components/skip-link';
import { useLocale } from '@/shared/i18n/use-locale';
import {
  applyDocumentMeta,
  metaFromProfile,
  restoreDocumentMeta,
} from '@/shared/lib/document-meta';
import { HOME_SLUG, profilePath } from '@/shared/lib/profile-link';
import { useUrlState } from '@/shared/lib/url-state';
import { resolveLayoutName } from '@/themes/layouts';
import { ProfileLayout } from '@/themes/layouts/ProfileLayout';
import { renderableSections } from '@/themes/layouts/sections';
import { ThemeProvider } from '@/themes/theme-provider';
import { PrintableSheet } from './print/PrintableSheet';
import { AccessTokenForm } from './components/AccessTokenForm';
import { ErrorState } from './components/ErrorState';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { NotFound } from './components/NotFound';
import { useCuratedProfile } from './hooks/use-curated-profile';
import { useStagedSections } from './hooks/use-staged-sections';

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

  // Hero primero, el resto en una transición (D1 de `improve-mobile-performance`).
  const renderable = useMemo(() => (data ? renderableSections(data.sections) : null), [data]);
  const staged = useStagedSections(renderable);
  const menusReady =
    staged.revealed ||
    state.status === 'notFound' ||
    state.status === 'needsToken' ||
    state.status === 'error';

  // Resuelto por un slug anterior: la URL pasa al canónico sin sumar una entrada al
  // historial, para que se comparta y se marque el link vigente (decisión D5).
  const navigate = useNavigate();
  const { search } = useLocation();
  const canonicalSlug = data?.slug;
  useEffect(() => {
    if (canonicalSlug && canonicalSlug !== slug) {
      void navigate({ pathname: profilePath(canonicalSlug), search }, { replace: true });
    }
  }, [canonicalSlug, slug, search, navigate]);

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
        <>
          <ProfileLayout name={layoutName} data={state.data} sections={staged.sections ?? []} />
          {/* Reserva el alto de las secciones aún no reveladas para que el pie no se mueva. */}
          {staged.pending && <div aria-hidden className="min-h-screen" />}
        </>
      );
      break;
  }

  return (
    <ThemeProvider profileTokens={data?.theme?.tokens ?? null} presetSlug={url.theme}>
      <SkipLink />
      <div className="relative flex min-h-screen flex-col print:hidden">
        <div aria-hidden className="pointer-events-none fixed inset-0 bg-glow" />
        <div className="relative z-10 flex flex-1 flex-col">
          <TopBar
            activeSlug={slug}
            brand={data?.profile?.fullName}
            layout={layoutName}
            showProfileMenu={slug === HOME_SLUG}
            onPrint={data ? () => window.print() : undefined}
            menusReady={menusReady}
          />
          <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 outline-none">
            {content}
          </main>
          <Footer name={data?.profile?.fullName} />
        </div>
      </div>
      {/* Solo se ve al imprimir (spec `printable-curated-profile`, decisión D1). */}
      {data && <PrintableSheet data={data} locale={locale} />}
    </ThemeProvider>
  );
}
