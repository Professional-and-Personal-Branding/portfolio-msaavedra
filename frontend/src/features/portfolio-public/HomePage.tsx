import { CuratedProfileView } from '@/features/curated-view/CuratedProfileView';

/** La home es el perfil curado `all` (decisión D7). */
export function HomePage() {
  return <CuratedProfileView slug="all" />;
}
