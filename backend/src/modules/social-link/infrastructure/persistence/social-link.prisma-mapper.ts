import { Logger } from '@nestjs/common';
import type { SocialLink as SocialLinkRecord } from '@prisma/client';
import { toLocalizedText } from '../../../../shared/infrastructure/persistence/json.guards';
import { isPlainObject } from '../../../theme/domain/services/merge-theme-tokens';
import { SocialLink } from '../../domain/entities/social-link.entity';

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
