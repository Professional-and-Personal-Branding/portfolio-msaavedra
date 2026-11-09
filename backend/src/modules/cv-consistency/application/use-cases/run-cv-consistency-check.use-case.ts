import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, Clock } from '../../../../shared/domain/clock';
import { Locale } from '../../../../shared/domain/i18n';
import { Ok, ok } from '../../../../shared/domain/result';
import {
  CERTIFICATION_REPOSITORY,
  CertificationRepository,
  EDUCATION_REPOSITORY,
  EducationRepository,
} from '../../../education/domain/repositories/education.repository';
import {
  CURATED_PROFILE_REPOSITORY,
  CuratedProfileRepository,
} from '../../../curated-profile/domain/repositories/curated-profile.repository';
import {
  EXPERIENCE_REPOSITORY,
  ExperienceRepository,
} from '../../../experience/domain/repositories/experience.repository';
import {
  PROFILE_REPOSITORY,
  ProfileRepository,
} from '../../../profile/domain/repositories/profile.repository';
import {
  PROJECT_REPOSITORY,
  ProjectRepository,
} from '../../../project/domain/repositories/project.repository';
import {
  SKILL_CATEGORY_REPOSITORY,
  SkillCategoryRepository,
} from '../../../skill/domain/repositories/skill-category.repository';
import {
  SOCIAL_LINK_REPOSITORY,
  SocialLinkRepository,
} from '../../../social-link/domain/repositories/social-link.repository';
import { buildCvReport } from '../build-cv-report';
import { CvConsistencyReport } from '../cv-consistency.output';
import { toCvSnapshot } from '../to-cv-snapshot';

export interface RunCvConsistencyCheckInput {
  readonly locale: Locale;
}

/**
 * Revisión de consistencia del CV (D9 de `add-cv-consistency-rules`). Solo lee: una consulta
 * por repositorio, en paralelo y fijas (ocho), sin importar cuántos ítems haya, y nunca llama a
 * un método de escritura. `asOf` es el mes UTC del reloj inyectado (D11).
 */
@Injectable()
export class RunCvConsistencyCheckUseCase {
  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository,
    @Inject(EXPERIENCE_REPOSITORY) private readonly experiences: ExperienceRepository,
    @Inject(SKILL_CATEGORY_REPOSITORY) private readonly skills: SkillCategoryRepository,
    @Inject(EDUCATION_REPOSITORY) private readonly education: EducationRepository,
    @Inject(CERTIFICATION_REPOSITORY) private readonly certifications: CertificationRepository,
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(SOCIAL_LINK_REPOSITORY) private readonly socialLinks: SocialLinkRepository,
    @Inject(CURATED_PROFILE_REPOSITORY) private readonly curatedProfiles: CuratedProfileRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(input: RunCvConsistencyCheckInput): Promise<Ok<CvConsistencyReport>> {
    const [
      profile,
      experiences,
      skillCategories,
      education,
      certifications,
      projects,
      socialLinks,
      curatedProfiles,
    ] = await Promise.all([
      this.profiles.findOne(),
      this.experiences.findAll(),
      this.skills.findAll(),
      this.education.findAll(),
      this.certifications.findAll(),
      this.projects.findAll(),
      this.socialLinks.findAll(),
      this.curatedProfiles.findAll(),
    ]);
    const snapshot = toCvSnapshot({
      profile,
      experiences,
      skillCategories,
      education,
      certifications,
      projects,
      socialLinks,
      curatedProfiles,
    });
    const asOf = this.clock.now().toISOString().slice(0, 7);
    return ok(buildCvReport(snapshot, asOf, input.locale));
  }
}
