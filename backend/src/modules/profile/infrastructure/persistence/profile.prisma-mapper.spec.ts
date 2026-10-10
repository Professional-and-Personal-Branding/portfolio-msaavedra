import { Prisma } from '@prisma/client';
import {
  ProfileRecord,
  toLanguageData,
  toProfileData,
  toProfileEntity,
} from './profile.prisma-mapper';

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
      level: { es: 'Nativo', en: 'Native' },
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
    // Una columna Json vacía sigue siendo null: guardar no la convierte en `{}`.
    expect(profile.availability.contractType).toBeNull();
    expect(profile.languages[0].detail).toBeNull();
    expect(profile.languages).toHaveLength(1);
    expect(profile.languages[0].nameI18n).toEqual({ es: 'Español', en: 'Spanish' });
    expect(profile.languages[0].level).toEqual({ es: 'Nativo', en: 'Native' });
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

describe('toProfileData / toLanguageData', () => {
  it('ida y vuelta: los nulos se escriben como DbNull y el resto tal cual', () => {
    const data = toProfileData(toProfileEntity(baseRecord).content());
    expect(data.headline).toEqual({ es: 'Titular', en: 'Headline' });
    expect(data.availModality).toEqual({ es: 'Remoto', en: 'Remote' });
    expect(data.availContractType).toBe(Prisma.DbNull);
    expect(data.availStartDate).toBe('Inmediata');
    expect(data).not.toHaveProperty('languages');
  });

  it('idioma sin traducción ni detalle', () => {
    const data = toLanguageData({
      name: 'Inglés',
      nameI18n: null,
      level: { es: 'Intermedio', en: 'Intermediate' },
      detail: null,
    });
    expect(data).toEqual({
      name: 'Inglés',
      nameI18n: Prisma.DbNull,
      level: { es: 'Intermedio', en: 'Intermediate' },
      detail: Prisma.DbNull,
    });
  });

  it('el nivel legado (string) se lee y se escribe tal cual', () => {
    const [legacy] = toProfileEntity({
      ...baseRecord,
      languages: [{ ...baseRecord.languages[0], level: 'C1' }],
    }).languages;
    expect(legacy.level).toBe('C1');
    const data = toLanguageData({ name: 'Italiano', nameI18n: null, level: 'C1', detail: null });
    expect(data.level).toBe('C1');
  });
});
