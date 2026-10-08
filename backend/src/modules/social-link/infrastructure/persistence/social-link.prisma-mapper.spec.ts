import { Prisma } from '@prisma/client';
import {
  SocialLinkRecord,
  toSocialLinkData,
  toSocialLinkEntity,
} from './social-link.prisma-mapper';

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

describe('toSocialLinkData', () => {
  it('Json nulo → DbNull; objetos se conservan', () => {
    const { id: _id, ...props } = toSocialLinkEntity(record).toProps();
    const data = toSocialLinkData(props);
    expect(data.description).toBe(Prisma.DbNull);
    expect(data.stats).toEqual({ repos: 67 });
    expect(data.label).toEqual({ es: 'Código', en: 'Code' });
    expect(toSocialLinkData({ ...props, stats: null }).stats).toBe(Prisma.DbNull);
  });
});
