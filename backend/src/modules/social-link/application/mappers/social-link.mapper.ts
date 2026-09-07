import { Locale, resolveLocale } from '../../../../shared/domain/i18n';
import { SocialLink } from '../../domain/entities/social-link.entity';
import { SocialLinkOutput } from '../dto/social-link.output';

export function toSocialLinkOutput(s: SocialLink, locale: Locale): SocialLinkOutput {
  return {
    id: s.id,
    platform: s.platform,
    handle: s.handle,
    url: s.url,
    label: resolveLocale(s.label, locale),
    description: resolveLocale(s.description, locale),
    stats: s.stats,
    featured: s.featured,
    order: s.order,
  };
}
