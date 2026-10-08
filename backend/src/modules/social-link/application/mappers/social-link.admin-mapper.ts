import { SocialLink } from '../../domain/entities/social-link.entity';
import { AdminSocialLinkOutput } from '../dto/social-link.admin-output';

export function toAdminSocialLinkOutput(s: SocialLink): AdminSocialLinkOutput {
  return {
    id: s.id,
    platform: s.platform,
    handle: s.handle,
    url: s.url,
    label: s.label,
    description: s.description,
    stats: s.stats,
    featured: s.featured,
    order: s.order,
    visible: s.visible,
  };
}
