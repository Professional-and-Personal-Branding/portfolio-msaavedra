import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ExperienceModule } from '../experience/experience.module';
import { ProfileModule } from '../profile/profile.module';
import { SkillModule } from '../skill/skill.module';
import { ThemeModule } from '../theme/theme.module';
import {
  CreateCuratedProfileUseCase,
  DeleteCuratedProfileUseCase,
  GetCuratedProfileAdminUseCase,
  ListAllCuratedProfilesUseCase,
  UpdateCuratedProfileUseCase,
} from './application/use-cases/admin/curated-profile-admin.use-cases';
import { ListCuratedProfilesUseCase } from './application/use-cases/list-curated-profiles.use-case';
import { ResolveCuratedProfileUseCase } from './application/use-cases/resolve-curated-profile.use-case';
import { CURATED_PROFILE_REPOSITORY } from './domain/repositories/curated-profile.repository';
import { AdminCuratedProfileController } from './infrastructure/controllers/admin-curated-profile.controller';
import { CuratedProfileController } from './infrastructure/controllers/curated-profile.controller';
import { PrismaCuratedProfileRepository } from './infrastructure/persistence/prisma-curated-profile.repository';

/**
 * Núcleo del producto. Consume los puertos exportados por profile, experience,
 * skill, theme y analytics; el resolver nunca toca Prisma directamente.
 */
@Module({
  imports: [ProfileModule, ExperienceModule, SkillModule, ThemeModule, AnalyticsModule],
  controllers: [CuratedProfileController, AdminCuratedProfileController],
  providers: [
    { provide: CURATED_PROFILE_REPOSITORY, useClass: PrismaCuratedProfileRepository },
    ListCuratedProfilesUseCase,
    ResolveCuratedProfileUseCase,
    ListAllCuratedProfilesUseCase,
    GetCuratedProfileAdminUseCase,
    CreateCuratedProfileUseCase,
    UpdateCuratedProfileUseCase,
    DeleteCuratedProfileUseCase,
  ],
  exports: [ResolveCuratedProfileUseCase, ListCuratedProfilesUseCase],
})
export class CuratedProfileModule {}
