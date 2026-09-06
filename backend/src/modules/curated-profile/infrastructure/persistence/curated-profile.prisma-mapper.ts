import { Logger } from '@nestjs/common';
import type { CuratedProfile as CuratedProfileRecord } from '@prisma/client';
import { toLocalizedText } from '../../../../shared/infrastructure/persistence/json.guards';
import {
  CuratedProfile,
  CuratedVisibility,
  isCuratedVisibility,
} from '../../domain/entities/curated-profile.entity';
import { AccessToken } from '../../domain/value-objects/access-token.vo';

export type { CuratedProfileRecord };

const logger = new Logger('CuratedProfilePrismaMapper');

function toVisibility(value: string, slug: string): CuratedVisibility {
  if (isCuratedVisibility(value)) return value;
  // Un valor desconocido se trata como el más restrictivo.
  logger.warn(`CuratedProfile "${slug}" con visibility desconocida "${value}"; se usa PRIVATE`);
  return 'PRIVATE';
}

export function toCuratedProfileEntity(record: CuratedProfileRecord): CuratedProfile {
  return CuratedProfile.create({
    id: record.id,
    slug: record.slug,
    title: toLocalizedText(record.title, 'CuratedProfile.title'),
    headline: toLocalizedText(record.headline, 'CuratedProfile.headline'),
    description: toLocalizedText(record.description, 'CuratedProfile.description'),
    roleType: toLocalizedText(record.roleType, 'CuratedProfile.roleType'),
    techFocus: record.techFocus,
    filterTags: record.filterTags,
    includeIds: record.includeIds,
    excludeIds: record.excludeIds,
    accentColor: record.accentColor,
    themeId: record.themeId,
    themeOverrides: record.themeOverrides,
    layout: record.layout,
    sectionsOrder: record.sectionsOrder,
    sectionsHidden: record.sectionsHidden,
    visibility: toVisibility(record.visibility, record.slug),
    accessToken: AccessToken.create(record.accessToken),
    views: record.views,
  });
}
