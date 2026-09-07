import { CuratedProfile } from '../../domain/entities/curated-profile.entity';
import { AdminCuratedProfileOutput } from '../dto/curated-profile.admin-output';

export function toAdminCuratedProfileOutput(p: CuratedProfile): AdminCuratedProfileOutput {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    headline: p.headline,
    description: p.description,
    roleType: p.roleType,
    techFocus: p.techFocus,
    filterTags: [...p.filterTags],
    includeIds: [...p.includeIds],
    excludeIds: [...p.excludeIds],
    accentColor: p.accentColor,
    themeId: p.themeId,
    themeOverrides: p.themeOverrides ?? null,
    layout: p.layout,
    sectionsOrder: [...p.sectionsOrder],
    sectionsHidden: [...p.sectionsHidden],
    visibility: p.visibility,
    accessToken: p.accessToken.value,
    views: p.views,
    createdAt: p.createdAt?.toISOString() ?? null,
    updatedAt: p.updatedAt?.toISOString() ?? null,
  };
}
