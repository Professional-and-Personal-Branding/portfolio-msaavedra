import { Logger } from '@nestjs/common';
import type { CuratedProfile as CuratedProfileRecord } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { toLocalizedText } from '../../../../shared/infrastructure/persistence/json.guards';
import {
  CuratedProfile,
  CuratedVisibility,
  isCuratedVisibility,
  NewCuratedProfileProps,
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
    archivedAt: record.archivedAt,
    listed: record.listed,
    views: record.views,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

/**
 * Props de dominio → datos de escritura Prisma. `null` en Json se persiste como
 * DbNull. `archivedAt` solo viaja al actualizar (lo fijan archivar y desarchivar);
 * al crear queda nulo.
 */
export function toCuratedProfileData(
  props: NewCuratedProfileProps & { archivedAt?: Date | null },
): Prisma.CuratedProfileUncheckedCreateInput {
  const json = (v: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull =>
    v === null || v === undefined ? Prisma.DbNull : v;
  return {
    slug: props.slug,
    title: props.title,
    headline: props.headline,
    description: json(props.description),
    roleType: json(props.roleType),
    techFocus: props.techFocus,
    filterTags: [...props.filterTags],
    includeIds: [...props.includeIds],
    excludeIds: [...props.excludeIds],
    accentColor: props.accentColor,
    themeId: props.themeId,
    themeOverrides: json(props.themeOverrides),
    layout: props.layout,
    sectionsOrder: [...props.sectionsOrder],
    sectionsHidden: [...props.sectionsHidden],
    visibility: props.visibility,
    accessToken: props.accessToken.value,
    listed: props.listed ?? true,
    ...(props.archivedAt !== undefined ? { archivedAt: props.archivedAt } : {}),
  };
}
