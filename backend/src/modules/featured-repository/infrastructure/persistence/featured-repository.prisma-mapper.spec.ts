import {
  toFeaturedRepositoryData,
  toFeaturedRepositoryEntity,
} from './featured-repository.prisma-mapper';

describe('mapper de FeaturedRepository', () => {
  const record = {
    id: 'r1',
    name: 'reservas-api',
    url: 'https://github.com/octo-org/reservas-api',
    language: null,
    description: { es: 'API', en: 'API EN' },
    technologies: ['Java'],
    tags: ['java'],
    stars: 12,
    order: 2,
    visible: false,
  };

  it('mapea el registro, ignora stars y conserva language nulo', () => {
    const entity = toFeaturedRepositoryEntity(record);
    expect(entity.toProps()).toEqual({
      id: 'r1',
      name: 'reservas-api',
      url: 'https://github.com/octo-org/reservas-api',
      language: null,
      description: { es: 'API', en: 'API EN' },
      technologies: ['Java'],
      tags: ['java'],
      order: 2,
      visible: false,
    });
    expect('stars' in entity.toProps()).toBe(false);
  });

  it('JSON malformado en la descripción → vacío', () => {
    expect(toFeaturedRepositoryEntity({ ...record, description: 42 }).description).toEqual({});
  });

  it('ida y vuelta: los datos de escritura no incluyen id ni stars', () => {
    const { id: _id, ...props } = toFeaturedRepositoryEntity(record).toProps();
    const data = toFeaturedRepositoryData(props);
    expect(data).toEqual({
      name: 'reservas-api',
      url: 'https://github.com/octo-org/reservas-api',
      language: null,
      description: { es: 'API', en: 'API EN' },
      technologies: ['Java'],
      tags: ['java'],
      order: 2,
      visible: false,
    });
  });
});
