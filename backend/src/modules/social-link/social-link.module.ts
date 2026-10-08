import { Module } from '@nestjs/common';
import {
  CreateSocialLinkUseCase,
  DeleteSocialLinkUseCase,
  GetSocialLinkAdminUseCase,
  ListAllSocialLinksUseCase,
  UpdateSocialLinkUseCase,
} from './application/use-cases/admin/social-link-admin.use-cases';
import { ListSocialLinksUseCase } from './application/use-cases/list-social-links.use-case';
import { SOCIAL_LINK_REPOSITORY } from './domain/repositories/social-link.repository';
import { AdminSocialLinkController } from './infrastructure/controllers/admin-social-link.controller';
import { SocialLinkController } from './infrastructure/controllers/social-link.controller';
import { PrismaSocialLinkRepository } from './infrastructure/persistence/prisma-social-link.repository';

/**
 * Presencia pública: lectura, puerto para la resolución curada y
 * administración desde el backoffice.
 */
@Module({
  controllers: [SocialLinkController, AdminSocialLinkController],
  providers: [
    { provide: SOCIAL_LINK_REPOSITORY, useClass: PrismaSocialLinkRepository },
    ListSocialLinksUseCase,
    ListAllSocialLinksUseCase,
    GetSocialLinkAdminUseCase,
    CreateSocialLinkUseCase,
    UpdateSocialLinkUseCase,
    DeleteSocialLinkUseCase,
  ],
  exports: [SOCIAL_LINK_REPOSITORY],
})
export class SocialLinkModule {}
