import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { EducationModule } from '../education/education.module';
import { ExperienceModule } from '../experience/experience.module';
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
import { PreviewCuratedProfileUseCase } from './application/use-cases/admin/preview-curated-profile.use-case';
import { ListCuratedProfilesUseCase } from './application/use-cases/list-curated-profiles.use-case';
import { ResolveCuratedProfileUseCase } from './application/use-cases/resolve-curated-profile.use-case';
import { CURATED_PROFILE_REPOSITORY } from './domain/repositories/curated-profile.repository';
import { AdminCuratedProfileController } from './infrastructure/controllers/admin-curated-profile.controller';
import { CuratedProfileController } from './infrastructure/controllers/curated-profile.controller';
import { PrismaCuratedProfileRepository } from './infrastructure/persistence/prisma-curated-profile.repository';

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
    EducationModule,
    ProjectModule,
    SocialLinkModule,
  ],
  controllers: [CuratedProfileController, AdminCuratedProfileController],
  providers: [
    { provide: CURATED_PROFILE_REPOSITORY, useClass: PrismaCuratedProfileRepository },
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
  ],
  exports: [ResolveCuratedProfileUseCase, ListCuratedProfilesUseCase],
})
export class CuratedProfileModule {}
