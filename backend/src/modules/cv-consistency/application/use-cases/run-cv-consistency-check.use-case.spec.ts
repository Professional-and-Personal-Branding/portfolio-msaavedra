import { Clock } from '../../../../shared/domain/clock';
import { RunCvConsistencyCheckUseCase } from './run-cv-consistency-check.use-case';

/** Dobles mínimos: el caso de uso solo lee los campos que `toCvSnapshot` copia. */
function stub<T>(fields: Record<string, unknown>): T {
  return fields as unknown as T;
}

const both = (es: string, en: string) => ({ es, en });

const experience = (fields: Record<string, unknown> = {}) =>
  stub({
    id: 'exp1',
    company: 'Acme',
    startDate: '2020-01',
    endDate: '2020-12',
    current: false,
    visible: true,
    tags: ['backend'],
    role: both('Dev', 'Dev'),
    summary: both('Resumen', 'Summary'),
    highlights: { es: ['a'], en: ['a'] },
    ...fields,
  });

const profile = (fields: Record<string, unknown> = {}) =>
  stub({
    id: 'p1',
    fullName: 'Ana Ejemplo',
    yearsOfExperience: 1,
    headline: both('H', 'H'),
    summary: both('S', 'S'),
    availability: { modality: null, contractType: null, startDate: null },
    languages: [],
    ...fields,
  });

function build(
  overrides: {
    profile?: unknown;
    experiences?: unknown[];
    curated?: unknown[];
    now?: Date;
  } = {},
) {
  const repos = {
    profile: {
      findOne: jest.fn().mockResolvedValue('profile' in overrides ? overrides.profile : profile()),
      save: jest.fn(),
      update: jest.fn(),
    },
    experience: {
      findAll: jest.fn().mockResolvedValue(overrides.experiences ?? [experience()]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    skills: {
      findAll: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    education: {
      findAll: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    certifications: {
      findAll: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    projects: {
      findAll: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    repositories: {
      findAll: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    socialLinks: {
      findAll: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    curated: {
      findAll: jest.fn().mockResolvedValue(overrides.curated ?? []),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const clock: Clock = { now: () => overrides.now ?? new Date('2026-11-15T12:00:00Z') };
  const useCase = new RunCvConsistencyCheckUseCase(
    repos.profile,
    repos.experience as never,
    repos.skills as never,
    repos.education as never,
    repos.certifications as never,
    repos.projects as never,
    repos.repositories as never,
    repos.socialLinks as never,
    repos.curated as never,
    clock,
  );
  return { useCase, repos };
}

describe('RunCvConsistencyCheckUseCase', () => {
  it('consulta cada repositorio una sola vez y no escribe nada', async () => {
    const { useCase, repos } = build({
      experiences: Array.from({ length: 15 }, (_, i) => experience({ id: `exp${i}` })),
      curated: Array.from({ length: 14 }, (_, i) =>
        stub({
          id: `cp${i}`,
          slug: `perfil-${i}`,
          isArchived: false,
          filterTags: [],
          includeIds: [],
          excludeIds: [],
          title: both('T', 'T'),
          headline: both('H', 'H'),
          description: null,
          roleType: null,
        }),
      ),
    });
    await useCase.execute({ locale: 'es' });

    expect(repos.profile.findOne).toHaveBeenCalledTimes(1);
    for (const key of [
      'experience',
      'skills',
      'education',
      'certifications',
      'projects',
      'socialLinks',
      'curated',
    ] as const) {
      expect(repos[key].findAll).toHaveBeenCalledTimes(1);
    }
    for (const repo of Object.values(repos)) {
      for (const [method, fn] of Object.entries(repo)) {
        if (method !== 'findAll' && method !== 'findOne') expect(fn).not.toHaveBeenCalled();
      }
    }
  });

  it('sin perfil base, experience es null y no falla', async () => {
    const { useCase } = build({ profile: null });
    const result = await useCase.execute({ locale: 'es' });
    expect(result.value.experience).toBeNull();
    expect(result.value.issues.filter((i) => i.code === 'profile.years-mismatch')).toEqual([]);
  });

  it('asOf es el mes UTC del reloj: 2026-11-30T23:30:00-04:00 es diciembre en UTC', async () => {
    const { useCase } = build({ now: new Date('2026-11-30T23:30:00-04:00') });
    expect((await useCase.execute({ locale: 'es' })).value.asOf).toBe('2026-12');
  });

  it('devuelve el declarado y los meses derivados', async () => {
    const { useCase } = build({ profile: profile({ yearsOfExperience: 10 }) });
    const { value } = await useCase.execute({ locale: 'es' });
    expect(value.experience).toEqual({ declaredYears: 10, derivedMonths: 12 });
    expect(value.summary).toEqual({ error: 0, warning: 1, info: 0 });
    expect(value.issues[0]).toMatchObject({
      code: 'profile.years-mismatch',
      entityType: 'profile',
      entityId: 'p1',
      entityLabel: 'Ana Ejemplo',
      field: 'yearsOfExperience',
      message:
        'Declarás 10 años de experiencia, pero las experiencias cargadas suman 1 años y 0 meses.',
      params: { declared: 10, months: 12, years: 1, remainderMonths: 0 },
    });
  });

  it('ordena por severidad, tipo de entidad, etiqueta y código', async () => {
    const { useCase } = build({
      profile: profile({ yearsOfExperience: 10 }),
      experiences: [
        experience({ id: 'expB', company: 'Beta', startDate: '2024-13' }),
        experience({ id: 'expA', company: 'Alfa', endDate: '2019-01' }),
        experience({ id: 'expC', company: 'Gamma', summary: both('Resumen', '') }),
        experience({ id: 'expD', company: 'Delta', current: true, endDate: null }),
        experience({ id: 'expE', company: 'Epsilon', current: true, endDate: null }),
      ],
    });
    const { issues } = (await useCase.execute({ locale: 'es' })).value;
    expect(issues.map((i) => `${i.severity}|${i.entityType}|${i.entityLabel}|${i.code}`)).toEqual([
      'error|experience|Alfa|date.end-before-start',
      'error|experience|Beta|date.invalid-format',
      'warning|profile|Ana Ejemplo|profile.years-mismatch',
      'warning|experience|Gamma|i18n.missing-translation',
      'info|experience|Delta|experience.multiple-current',
      'info|experience|Epsilon|experience.multiple-current',
    ]);
  });

  it('dos corridas iguales devuelven lo mismo', async () => {
    const { useCase } = build({ profile: profile({ yearsOfExperience: 10 }) });
    const first = await useCase.execute({ locale: 'es' });
    const second = await useCase.execute({ locale: 'es' });
    expect(second).toEqual(first);
  });

  it('con locale en traduce message y entityLabel y no cambia code', async () => {
    const profileWithEnglishName = profile({ yearsOfExperience: 10 });
    const experiences = [
      experience({ id: 'expC', company: 'Gamma', summary: both('Resumen', '') }),
    ];
    const es = (
      await build({ profile: profileWithEnglishName, experiences }).useCase.execute({
        locale: 'es',
      })
    ).value;
    const en = (
      await build({ profile: profileWithEnglishName, experiences }).useCase.execute({
        locale: 'en',
      })
    ).value;

    expect(en.issues.map((i) => i.code)).toEqual(es.issues.map((i) => i.code));
    const missingEs = es.issues.find((i) => i.code === 'i18n.missing-translation');
    const missingEn = en.issues.find((i) => i.code === 'i18n.missing-translation');
    expect(missingEs?.message).toBe('Falta el texto en inglés de summary.');
    expect(missingEn?.message).toBe('The English text for summary is missing.');
    const yearsEn = en.issues.find((i) => i.code === 'profile.years-mismatch');
    expect(yearsEn?.message).toMatch(/^You declare 10 years of experience/);
  });
});
