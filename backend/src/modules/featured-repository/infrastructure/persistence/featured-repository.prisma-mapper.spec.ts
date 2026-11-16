import {
  toFeaturedRepositoryData,
  toFeaturedRepositoryEntity,
  toRepositoryEvidence,
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

  it('mapea el registro, ignora la columna stars y conserva language nulo', () => {
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
      evidence: null,
    });
    expect('stars' in entity.toProps()).toBe(false);
  });

  it('JSON malformado en la descripción → vacío', () => {
    expect(toFeaturedRepositoryEntity({ ...record, description: 42 }).description).toEqual({});
  });

  it('ida y vuelta: los datos de escritura no incluyen id, stars ni evidencia', () => {
    const { id: _id, evidence: _evidence, ...props } = toFeaturedRepositoryEntity(record).toProps();
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

  describe('evidencia', () => {
    const evidenceRecord = {
      featuredRepositoryId: 'r1',
      repoKey: 'octo-org/reservas-api',
      status: 'OK' as const,
      stars: 12,
      primaryLanguage: 'Java',
      languages: { Java: 8200, CSS: 1200, Roto: 'x', Negativo: -3 },
      topics: ['api'],
      pushedAt: new Date('2026-10-30T12:00:00Z'),
      archived: false,
      isFork: false,
      movedTo: null,
      githubDescription: 'API de reservas',
      verifiedAt: new Date('2026-11-16T10:00:00Z'),
      changedAt: new Date('2026-11-15T10:00:00Z'),
    };

    it('la entidad trae la evidencia cuando el registro la incluye', () => {
      const entity = toFeaturedRepositoryEntity({ ...record, evidence: evidenceRecord });
      expect(entity.evidence).toMatchObject({
        repoKey: 'octo-org/reservas-api',
        status: 'OK',
        stars: 12,
        languages: { Java: 8200, CSS: 1200 },
      });
    });

    it('un mapa de lenguajes que no es un objeto queda nulo', () => {
      expect(toRepositoryEvidence({ ...evidenceRecord, languages: [1, 2] }).languages).toBeNull();
      expect(toRepositoryEvidence({ ...evidenceRecord, languages: null }).languages).toBeNull();
    });
  });
});
