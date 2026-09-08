import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { CuratedProfilePage } from '@/features/curated-view/CuratedProfilePage';
import { NotFoundPage } from '@/features/curated-view/NotFoundPage';
import { HomePage } from '@/features/portfolio-public/HomePage';

/**
 * El backoffice va en su propio chunk: un visitante anónimo nunca lo descarga
 * (spec `admin-backoffice-shell` § Separación de la vista pública).
 */
const BackofficeApp = lazy(() => import('@/features/backoffice/BackofficeApp'));

/** Rutas declarativas: `/` = perfil curado `all`, `/:slug` = perfil curado, `/admin/*` = panel. */
export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<div className="min-h-screen bg-bg" />}>
            <BackofficeApp />
          </Suspense>
        }
      />
      <Route path="/:slug" element={<CuratedProfilePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
