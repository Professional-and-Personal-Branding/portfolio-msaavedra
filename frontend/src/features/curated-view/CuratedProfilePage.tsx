import { useParams } from 'react-router';
import { CuratedProfileView } from './CuratedProfileView';
import { NotFoundPage } from './NotFoundPage';

export function CuratedProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return <NotFoundPage />;
  return <CuratedProfileView slug={slug} />;
}
