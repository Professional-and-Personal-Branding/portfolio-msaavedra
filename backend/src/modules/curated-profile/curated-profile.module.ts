import { Module } from '@nestjs/common';
import { ExperienceModule } from '../experience/experience.module';
import { ProfileModule } from '../profile/profile.module';
import { SkillModule } from '../skill/skill.module';
import { ThemeModule } from '../theme/theme.module';
import { ListCuratedProfilesUseCase } from './application/use-cases/list-curated-profiles.use-case';
import { ResolveCuratedProfileUseCase } from './application/use-cases/resolve-curated-profile.use-case';
import { CURATED_PROFILE_REPOSITORY } from './domain/repositories/curated-profile.repository';
import { CuratedProfileController } from './infrastructure/controllers/curated-profile.controller';
import { PrismaCuratedProfileRepository } from './infrastructure/persistence/prisma-curated-profile.repository';

/**
 * Núcleo del producto. Consume los puertos exportados por profile, experience,
 * skill y theme; el resolver nunca toca Prisma directamente.
 */
@Module({
  imports: [ProfileModule, ExperienceModule, SkillModule, ThemeModule],
  controllers: [CuratedProfileController],
  providers: [
    { provide: CURATED_PROFILE_REPOSITORY, useClass: PrismaCuratedProfileRepository },
    ListCuratedProfilesUseCase,
    ResolveCuratedProfileUseCase,
  ],
  exports: [ResolveCuratedProfileUseCase, ListCuratedProfilesUseCase],
})
export class CuratedProfileModule {}
