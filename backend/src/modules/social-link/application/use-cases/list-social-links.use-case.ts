import { Inject, Injectable } from '@nestjs/common';
import { Locale } from '../../../../shared/domain/i18n';
import { ok, Ok } from '../../../../shared/domain/result';
import {
  SOCIAL_LINK_REPOSITORY,
  SocialLinkRepository,
} from '../../domain/repositories/social-link.repository';
import { SocialLinkOutput } from '../dto/social-link.output';
import { toSocialLinkOutput } from '../mappers/social-link.mapper';

@Injectable()
export class ListSocialLinksUseCase {
  constructor(@Inject(SOCIAL_LINK_REPOSITORY) private readonly repo: SocialLinkRepository) {}

  async execute(input: { locale: Locale }): Promise<Ok<SocialLinkOutput[]>> {
    const items = await this.repo.findAllVisible();
    return ok(items.filter((s) => s.visible).map((s) => toSocialLinkOutput(s, input.locale)));
  }
}
