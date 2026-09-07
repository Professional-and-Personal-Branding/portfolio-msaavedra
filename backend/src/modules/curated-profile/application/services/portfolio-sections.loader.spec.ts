import { Certification } from '../../../education/domain/entities/certification.entity';
import { Education } from '../../../education/domain/entities/education.entity';
import { Project } from '../../../project/domain/entities/project.entity';
import { SocialLink } from '../../../social-link/domain/entities/social-link.entity';
import { PortfolioSectionsLoader } from './portfolio-sections.loader';

describe('PortfolioSectionsLoader', () => {
  it('carga las cuatro secciones en paralelo y descarta ocultos', async () => {
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
      { findAllVisible: jest.fn().mockResolvedValue([edu]) },
      { findAllVisible: jest.fn().mockResolvedValue([hiddenCert]) },
      { findAllVisible: jest.fn().mockResolvedValue([project]) },
      { findAllVisible: jest.fn().mockResolvedValue([link]) },
    );
    const sections = await loader.load();
    expect(sections.education).toEqual([edu]);
    expect(sections.certifications).toEqual([]);
    expect(sections.projects).toEqual([project]);
    expect(sections.socialLinks).toEqual([link]);
  });
});
