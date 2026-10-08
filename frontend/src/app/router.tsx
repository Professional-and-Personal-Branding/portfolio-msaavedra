import { Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { BackofficeApp } from '@/app/lazy-backoffice';
import { CuratedProfilePage } from '@/features/curated-view/CuratedProfilePage';
import { NotFoundPage } from '@/features/curated-view/NotFoundPage';
import { HomePage } from '@/features/portfolio-public/HomePage';

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
