import type { CuratedProfile } from '@/shared/types/portfolio';

export interface SectionProps {
  data: CuratedProfile;
  /** `compact` para la columna lateral del layout `sidebar`. */
  variant?: 'default' | 'compact';
}
