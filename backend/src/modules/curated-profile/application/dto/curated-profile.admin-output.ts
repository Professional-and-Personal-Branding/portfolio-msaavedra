import { LocalizedText } from '../../../../shared/domain/i18n';
import { CuratedVisibility } from '../../domain/entities/curated-profile.entity';

/** Salida del backoffice: todo crudo, incluidos filtros, overrides y token. */
export interface AdminCuratedProfileOutput {
  id: string;
  slug: string;
  title: LocalizedText | string;
  headline: LocalizedText | string;
  description: LocalizedText | string | null;
  roleType: LocalizedText | string | null;
  techFocus: string | null;
  filterTags: string[];
  includeIds: string[];
  excludeIds: string[];
  accentColor: string;
  themeId: string | null;
  themeOverrides: unknown;
  layout: string;
  sectionsOrder: string[];
  sectionsHidden: string[];
  visibility: CuratedVisibility;
  accessToken: string | null;
  /** Se enumera en el listado público, el menú y el sitemap. */
  listed: boolean;
  /** ISO 8601 si está archivado (no resuelve); null si está vivo. */
  archivedAt: string | null;
  views: number;
  createdAt: string | null;
  updatedAt: string | null;
}
