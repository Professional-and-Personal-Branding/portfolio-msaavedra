import { Module } from '@nestjs/common';
import { ListSocialLinksUseCase } from './application/use-cases/list-social-links.use-case';
import { SOCIAL_LINK_REPOSITORY } from './domain/repositories/social-link.repository';
import { SocialLinkController } from './infrastructure/controllers/social-link.controller';
import { PrismaSocialLinkRepository } from './infrastructure/persistence/prisma-social-link.repository';

/** Presencia pública: lectura + puerto para la resolución curada. */
@Module({
  controllers: [SocialLinkController],
  providers: [
    { provide: SOCIAL_LINK_REPOSITORY, useClass: PrismaSocialLinkRepository },
    ListSocialLinksUseCase,
  ],
  exports: [SOCIAL_LINK_REPOSITORY],
})
export class SocialLinkModule {}
