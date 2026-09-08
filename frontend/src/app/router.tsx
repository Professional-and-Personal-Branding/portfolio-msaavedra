import { Route, Routes } from 'react-router';
import { CuratedProfilePage } from '@/features/curated-view/CuratedProfilePage';
import { NotFoundPage } from '@/features/curated-view/NotFoundPage';
import { HomePage } from '@/features/portfolio-public/HomePage';

/** Rutas declarativas (decisión D1): `/` = perfil curado `all`, `/:slug` = perfil curado. */
export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/:slug" element={<CuratedProfilePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
