import { Certification } from '../../../education/domain/entities/certification.entity';
import { Education } from '../../../education/domain/entities/education.entity';
import { FeaturedRepository } from '../../../featured-repository/domain/entities/featured-repository.entity';
import { Project } from '../../../project/domain/entities/project.entity';
import { SocialLink } from '../../../social-link/domain/entities/social-link.entity';
import { PortfolioSectionsLoader } from './portfolio-sections.loader';

/** El loader solo lee: los puertos también escriben (backoffice), pero acá basta la lectura. */
function readOnly<R>(items: unknown[]): R {
  return { findAllVisible: jest.fn().mockResolvedValue(items) } as unknown as R;
}

describe('PortfolioSectionsLoader', () => {
  it('carga las cinco secciones en paralelo y descarta ocultos', async () => {
    const edu = Education.create({
      id: 'e',
      degree: { es: 'x' },
      institution: 'U',
      startDate: '2020-01',
      endDate: null,
      inProgress: false,
      order: 0,
      visible: true,
    });
    const hiddenCert = Certification.create({
      id: 'c',
      name: { es: 'x' },
      issuer: 'I',
      year: null,
      verificationUrl: null,
      credentialId: null,
      expiresAt: null,
      order: 0,
      visible: false,
    });
    const project = Project.create({
      id: 'p',
      name: 'P',
      role: { es: 'r' },
      period: '2026',
      summary: { es: 's' },
      technologies: [],
      tags: ['java'],
      url: null,
      order: 0,
      visible: true,
    });
    const repository = FeaturedRepository.create({
      id: 'r',
      name: 'R',
      url: 'https://github.com/octo-org/r',
      language: null,
      description: { es: 'd' },
      technologies: [],
      tags: [],
      order: 0,
      visible: true,
    });
    const hiddenRepository = FeaturedRepository.create({
      ...repository.toProps(),
      id: 'rh',
      visible: false,
    });
    const link = SocialLink.create({
      id: 's',
      platform: 'github',
      handle: 'h',
      url: 'u',
      label: { es: 'l' },
      description: null,
      stats: null,
      featured: true,
      order: 0,
      visible: true,
    });
    const loader = new PortfolioSectionsLoader(
      readOnly([edu]),
      readOnly([hiddenCert]),
      readOnly([project]),
      readOnly([repository, hiddenRepository]),
      readOnly([link]),
    );
    const sections = await loader.load();
    expect(sections.education).toEqual([edu]);
    expect(sections.certifications).toEqual([]);
    expect(sections.projects).toEqual([project]);
    expect(sections.repositories).toEqual([repository]);
    expect(sections.socialLinks).toEqual([link]);
  });
});
