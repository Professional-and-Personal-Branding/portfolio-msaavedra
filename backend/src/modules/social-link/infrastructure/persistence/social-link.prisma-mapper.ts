import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SocialLink as SocialLinkRecord } from '@prisma/client';
import { toLocalizedText } from '../../../../shared/infrastructure/persistence/json.guards';
import { isPlainObject } from '../../../theme/domain/services/merge-theme-tokens';
import { NewSocialLinkProps, SocialLink } from '../../domain/entities/social-link.entity';

export type { SocialLinkRecord };

const logger = new Logger('SocialLinkPrismaMapper');

export function toSocialLinkEntity(r: SocialLinkRecord): SocialLink {
  let stats: Record<string, unknown> | null = null;
  if (r.stats != null) {
    if (isPlainObject(r.stats)) stats = r.stats;
    else logger.warn(`SocialLink "${r.platform}" con stats de forma inesperada; se usa null`);
  }
  return SocialLink.create({
    id: r.id,
    platform: r.platform,
    handle: r.handle,
    url: r.url,
    label: toLocalizedText(r.label, 'SocialLink.label'),
    description:
      r.description == null ? null : toLocalizedText(r.description, 'SocialLink.description'),
    stats,
    featured: r.featured,
    order: r.order,
    visible: r.visible,
  });
}

/** Json opcional: `null` se persiste como DbNull (columna SQL NULL). */
function nullableJson(
  value: Record<string, unknown> | NewSocialLinkProps['description'],
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}

/** Props de dominio → datos de escritura Prisma (Json para bilingües y stats). */
export function toSocialLinkData(props: NewSocialLinkProps): Prisma.SocialLinkUncheckedCreateInput {
  return {
    platform: props.platform,
    handle: props.handle,
    url: props.url,
    label: props.label,
    description: nullableJson(props.description),
    stats: nullableJson(props.stats),
    featured: props.featured,
    order: props.order,
    visible: props.visible,
  };
}
