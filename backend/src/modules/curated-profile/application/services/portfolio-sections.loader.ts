import { Inject, Injectable } from '@nestjs/common';
import { Certification } from '../../../education/domain/entities/certification.entity';
import { Education } from '../../../education/domain/entities/education.entity';
import {
  CERTIFICATION_REPOSITORY,
  CertificationRepository,
  EDUCATION_REPOSITORY,
  EducationRepository,
} from '../../../education/domain/repositories/education.repository';
import { Project } from '../../../project/domain/entities/project.entity';
import {
  PROJECT_REPOSITORY,
  ProjectRepository,
} from '../../../project/domain/repositories/project.repository';
import { SocialLink } from '../../../social-link/domain/entities/social-link.entity';
import {
  SOCIAL_LINK_REPOSITORY,
  SocialLinkRepository,
} from '../../../social-link/domain/repositories/social-link.repository';

export interface PortfolioSections {
  readonly education: Education[];
  readonly certifications: Certification[];
  readonly projects: Project[];
  readonly socialLinks: SocialLink[];
}

/**
 * Agrupa las lecturas de las secciones complementarias (D3): el resolver de perfiles
 * curados depende de este servicio en lugar de cuatro puertos más.
 */
@Injectable()
export class PortfolioSectionsLoader {
  constructor(
    @Inject(EDUCATION_REPOSITORY) private readonly education: EducationRepository,
    @Inject(CERTIFICATION_REPOSITORY) private readonly certifications: CertificationRepository,
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(SOCIAL_LINK_REPOSITORY) private readonly socialLinks: SocialLinkRepository,
  ) {}

  async load(): Promise<PortfolioSections> {
    const [education, certifications, projects, socialLinks] = await Promise.all([
      this.education.findAllVisible(),
      this.certifications.findAllVisible(),
      this.projects.findAllVisible(),
      this.socialLinks.findAllVisible(),
    ]);
    return {
      education: education.filter((e) => e.visible),
      certifications: certifications.filter((c) => c.visible),
      projects: projects.filter((p) => p.visible),
      socialLinks: socialLinks.filter((s) => s.visible),
    };
  }
}
