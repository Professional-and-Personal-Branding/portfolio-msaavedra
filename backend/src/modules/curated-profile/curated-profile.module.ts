import { Module } from '@nestjs/common';
import { CLOCK, systemClock } from '../../shared/domain/clock';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuthModule } from '../auth/auth.module';
import { EducationModule } from '../education/education.module';
import { ExperienceModule } from '../experience/experience.module';
import { FeaturedRepositoryModule } from '../featured-repository/featured-repository.module';
import { ProfileModule } from '../profile/profile.module';
import { ProjectModule } from '../project/project.module';
import { SkillModule } from '../skill/skill.module';
import { SocialLinkModule } from '../social-link/social-link.module';
import { ThemeModule } from '../theme/theme.module';
import { CuratedProfileComposer } from './application/services/curated-profile.composer';
import { PortfolioSectionsLoader } from './application/services/portfolio-sections.loader';
import {
  CreateCuratedProfileUseCase,
  DeleteCuratedProfileUseCase,
  GetCuratedProfileAdminUseCase,
  ListAllCuratedProfilesUseCase,
  UpdateCuratedProfileUseCase,
} from './application/use-cases/admin/curated-profile-admin.use-cases';
import {
  ArchiveCuratedProfileUseCase,
  DuplicateCuratedProfileUseCase,
  UnarchiveCuratedProfileUseCase,
} from './application/use-cases/admin/curated-profile-lifecycle.use-cases';
import {
  ExportCuratedProfileResumeForAdminUseCase,
  ExportCuratedProfileResumeUseCase,
} from './application/use-cases/export-curated-profile-resume.use-case';
import { PreviewCuratedProfileUseCase } from './application/use-cases/admin/preview-curated-profile.use-case';
import {
  CreateShareLinkUseCase,
  GetOrCreateLinkedInShareLinkUseCase,
  ListShareLinksUseCase,
  RenameShareLinkUseCase,
  RevokeShareLinkUseCase,
} from './application/use-cases/admin/share-links.use-cases';
import { SHARE_CODE_GENERATOR } from './application/ports/share-code.generator';
import { ProfileHeadCache } from './application/services/profile-head.cache';
import { BuildSitemapUseCase } from './application/use-cases/build-sitemap.use-case';
import { GetProfileHeadUseCase } from './application/use-cases/get-profile-head.use-case';
import { ListCuratedProfilesUseCase } from './application/use-cases/list-curated-profiles.use-case';
import { ResolveCuratedProfileUseCase } from './application/use-cases/resolve-curated-profile.use-case';
import { CURATED_PROFILE_REPOSITORY } from './domain/repositories/curated-profile.repository';
import { SHARE_LINK_REPOSITORY } from './domain/repositories/share-link.repository';
import { AdminShareLinkController } from './infrastructure/controllers/admin-share-link.controller';
import { AdminCuratedProfileController } from './infrastructure/controllers/admin-curated-profile.controller';
import { CuratedProfileController } from './infrastructure/controllers/curated-profile.controller';
import { ProfileHeadController } from './infrastructure/controllers/profile-head.controller';
import { SitemapController } from './infrastructure/controllers/sitemap.controller';
import { PrismaCuratedProfileRepository } from './infrastructure/persistence/prisma-curated-profile.repository';
import { PrismaShareLinkRepository } from './infrastructure/persistence/prisma-share-link.repository';
import { CryptoShareCodeGenerator } from './infrastructure/security/crypto-share-code.generator';

/**
 * Núcleo del producto. Consume los puertos exportados por profile, experience,
 * skill, theme, analytics y las secciones (education, project, social-link);
 * el resolver nunca toca Prisma directamente.
 */
@Module({
  imports: [
    ProfileModule,
    ExperienceModule,
    SkillModule,
    ThemeModule,
    AnalyticsModule,
    AuthModule,
    EducationModule,
    ProjectModule,
    FeaturedRepositoryModule,
    SocialLinkModule,
  ],
  controllers: [
    CuratedProfileController,
    AdminCuratedProfileController,
    AdminShareLinkController,
    SitemapController,
    ProfileHeadController,
  ],
  providers: [
    { provide: CURATED_PROFILE_REPOSITORY, useClass: PrismaCuratedProfileRepository },
    { provide: SHARE_LINK_REPOSITORY, useClass: PrismaShareLinkRepository },
    { provide: SHARE_CODE_GENERATOR, useClass: CryptoShareCodeGenerator },
    { provide: CLOCK, useValue: systemClock },
    PortfolioSectionsLoader,
    CuratedProfileComposer,
    ListCuratedProfilesUseCase,
    ResolveCuratedProfileUseCase,
    ListAllCuratedProfilesUseCase,
    GetCuratedProfileAdminUseCase,
    CreateCuratedProfileUseCase,
    UpdateCuratedProfileUseCase,
    DeleteCuratedProfileUseCase,
    PreviewCuratedProfileUseCase,
    DuplicateCuratedProfileUseCase,
    ArchiveCuratedProfileUseCase,
    UnarchiveCuratedProfileUseCase,
    ListShareLinksUseCase,
    CreateShareLinkUseCase,
    RenameShareLinkUseCase,
    RevokeShareLinkUseCase,
    GetOrCreateLinkedInShareLinkUseCase,
    BuildSitemapUseCase,
    GetProfileHeadUseCase,
    ExportCuratedProfileResumeUseCase,
    ExportCuratedProfileResumeForAdminUseCase,
    // Una sola instancia por proceso: la caché vive lo que vive la API.
    { provide: ProfileHeadCache, useValue: new ProfileHeadCache() },
  ],
  exports: [ResolveCuratedProfileUseCase, ListCuratedProfilesUseCase, CURATED_PROFILE_REPOSITORY],
})
export class CuratedProfileModule {}
