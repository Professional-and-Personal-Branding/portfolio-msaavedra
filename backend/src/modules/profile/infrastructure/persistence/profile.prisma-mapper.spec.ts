import { ProfileRecord, toProfileEntity } from './profile.prisma-mapper';

const baseRecord: ProfileRecord = {
  id: 'p1',
  fullName: 'Manuel',
  headline: { es: 'Titular', en: 'Headline' },
  location: 'Santa Cruz',
  timezone: 'GMT-4',
  email: 'm@example.com',
  phone: '+591',
  summary: { es: 'Resumen', en: 'Summary' },
  yearsOfExperience: 10,
  availModality: { es: 'Remoto', en: 'Remote' },
  availContractType: null,
  availStartDate: 'Inmediata', // dato plano legado
  createdAt: new Date(),
  updatedAt: new Date(),
  languages: [
    {
      id: 'l1',
      name: 'Español',
      nameI18n: { es: 'Español', en: 'Spanish' },
      level: 'Nativo',
      detail: null,
      profileId: 'p1',
    },
  ],
};

describe('toProfileEntity', () => {
  it('mapea campos planos, localizados, legados y nulos', () => {
    const profile = toProfileEntity(baseRecord);
    expect(profile.fullName).toBe('Manuel');
    expect(profile.headline).toEqual({ es: 'Titular', en: 'Headline' });
    expect(profile.availability.startDate).toBe('Inmediata');
    expect(profile.availability.contractType).toEqual({});
    expect(profile.languages).toHaveLength(1);
    expect(profile.languages[0].nameI18n).toEqual({ es: 'Español', en: 'Spanish' });
  });

  it('un JSON malformado no rompe: se mapea a vacío', () => {
    const malformed: ProfileRecord = {
      ...baseRecord,
      headline: { es: 123 },
      summary: [1] as never,
    };
    const profile = toProfileEntity(malformed);
    expect(profile.headline).toEqual({});
    expect(profile.summary).toEqual({});
  });
});
