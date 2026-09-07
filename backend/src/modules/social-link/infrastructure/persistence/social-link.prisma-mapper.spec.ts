import { SocialLinkRecord, toSocialLinkEntity } from './social-link.prisma-mapper';

const record: SocialLinkRecord = {
  id: 's1',
  platform: 'github',
  handle: 'manu',
  url: 'https://github.com/manu',
  label: { es: 'Código', en: 'Code' },
  description: null,
  stats: { repos: 67 },
  featured: true,
  order: 0,
  visible: true,
};

describe('toSocialLinkEntity', () => {
  it('mapea stats objeto y description nula', () => {
    const s = toSocialLinkEntity(record);
    expect(s.stats).toEqual({ repos: 67 });
    expect(s.description).toBeNull();
    expect(s.label).toEqual({ es: 'Código', en: 'Code' });
  });

  it('stats malformado → null', () => {
    expect(toSocialLinkEntity({ ...record, stats: [1, 2] }).stats).toBeNull();
    expect(toSocialLinkEntity({ ...record, stats: 'x' }).stats).toBeNull();
  });
});
