import { Module } from '@nestjs/common';
import { CLOCK, systemClock } from '../../shared/domain/clock';
import { AuthModule } from '../auth/auth.module';
import { CuratedProfileModule } from '../curated-profile/curated-profile.module';
import { EducationModule } from '../education/education.module';
import { ExperienceModule } from '../experience/experience.module';
import { ProfileModule } from '../profile/profile.module';
import { ProjectModule } from '../project/project.module';
import { SkillModule } from '../skill/skill.module';
import { SocialLinkModule } from '../social-link/social-link.module';
import { RunCvConsistencyCheckUseCase } from './application/use-cases/run-cv-consistency-check.use-case';
import { AdminCvConsistencyController } from './infrastructure/controllers/admin-cv-consistency.controller';

/**
 * Revisión de consistencia del CV (`add-cv-consistency-rules`). No tiene persistencia propia:
 * lee por los puertos que ya exportan los demás módulos.
 */
@Module({
  imports: [
    AuthModule,
    ProfileModule,
    ExperienceModule,
    SkillModule,
    EducationModule,
    ProjectModule,
    SocialLinkModule,
    CuratedProfileModule,
  ],
  controllers: [AdminCvConsistencyController],
  providers: [{ provide: CLOCK, useValue: systemClock }, RunCvConsistencyCheckUseCase],
})
export class CvConsistencyModule {}
