import { SocialLink, SocialLinkProps } from '../../domain/entities/social-link.entity';
import { ListSocialLinksUseCase } from './list-social-links.use-case';

const base: SocialLinkProps = {
  id: 'g',
  platform: 'github',
  handle: 'manu',
  url: 'https://github.com/manu',
  label: { es: 'Código', en: 'Code' },
  description: null,
  stats: { repos: 67, achievements: ['Pull Shark'] },
  featured: true,
  order: 0,
  visible: true,
};

describe('ListSocialLinksUseCase', () => {
  it('resuelve label/description, stats objeto o null, excluye ocultos', async () => {
    const github = SocialLink.create(base);
    const hidden = SocialLink.create({ ...base, id: 'h', visible: false });
    const repo = { findAllVisible: jest.fn().mockResolvedValue([github, hidden]) };
    const r = await new ListSocialLinksUseCase(repo).execute({ locale: 'en' });
    expect(r.value).toEqual([
      {
        id: 'g',
        platform: 'github',
        handle: 'manu',
        url: 'https://github.com/manu',
        label: 'Code',
        description: '',
        stats: { repos: 67, achievements: ['Pull Shark'] },
        featured: true,
        order: 0,
      },
    ]);
  });
});
