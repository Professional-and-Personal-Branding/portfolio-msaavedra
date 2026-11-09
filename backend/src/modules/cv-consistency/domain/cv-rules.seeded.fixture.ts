import { CvEntityType, CvIssueCode } from './cv-issue';
import {
  CvCertificationSnapshot,
  CvCuratedProfileSnapshot,
  CvExperienceSnapshot,
  CvProjectSnapshot,
  CvSnapshot,
} from './cv-snapshot';

/**
 * Fixture de errores sembrados (D14 de `add-cv-consistency-rules`): una instantánea limpia
 * (0 errores, 0 avisos, 0 sugerencias con `AS_OF`) y una mutación por cada código del catálogo.
 * Solo se usa en tests; `tsconfig.build.json` la excluye del build.
 */
export const AS_OF = '2026-11';

const both = (es: string, en: string) => ({ es, en });

const EXP_A: CvExperienceSnapshot = {
  id: 'exp-a',
  company: 'Acme',
  startDate: '2015-01',
  endDate: '2020-12',
  current: false,
  visible: true,
  tags: ['backend'],
  role: both('Desarrollador', 'Developer'),
  summary: both('Servicios de backend', 'Backend services'),
  highlights: { es: ['Logro uno', 'Logro dos'], en: ['Achievement one', 'Achievement two'] },
};

const EXP_B: CvExperienceSnapshot = {
  id: 'exp-b',
  company: 'Globex',
  startDate: '2021-03',
  endDate: null,
  current: true,
  visible: true,
  tags: ['backend', 'cloud'],
  role: both('Tech Lead', 'Tech Lead'),
  summary: both('Liderazgo técnico', 'Technical leadership'),
  highlights: { es: ['Logro tres'], en: ['Achievement three'] },
};

const CERTIFICATION: CvCertificationSnapshot = {
  id: 'cert-1',
  issuer: 'Emisor',
  year: '2022',
  verificationUrl: 'https://emisor.example/c/1',
  expiresAt: '2030-06',
  visible: true,
  name: both('Certificación', 'Certification'),
};

const PROJECT: CvProjectSnapshot = {
  id: 'proj-1',
  name: 'Portafolio',
  url: 'https://github.com/ejemplo/portafolio',
  visible: true,
  tags: ['backend'],
  role: both('Autor', 'Author'),
  summary: both('Resumen del proyecto', 'Project summary'),
};

const CURATED: CvCuratedProfileSnapshot = {
  id: 'cp-1',
  slug: 'backend',
  archived: false,
  filterTags: ['backend'],
  includeIds: [],
  excludeIds: [],
  title: both('Backend', 'Backend'),
  headline: both('Ingeniero backend', 'Backend engineer'),
  description: both('Perfil de backend', 'Backend profile'),
  roleType: both('Backend', 'Backend'),
};

/** Instantánea consistente: ninguna regla emite nada con `AS_OF`. */
export function cleanSnapshot(): CvSnapshot {
  return {
    profile: {
      id: 'profile-1',
      fullName: 'Ana Ejemplo',
      // 2015-01 a 2020-12 (72 meses) y 2021-03 a 2026-11 (69): 141 meses = 11,75 años.
      yearsOfExperience: 12,
      headline: both('Ingeniera de software', 'Software engineer'),
      summary: both('Resumen del perfil', 'Profile summary'),
      availabilityModality: both('Remoto', 'Remote'),
      availabilityContractType: both('Contractor', 'Contractor'),
      availabilityStartDate: both('Inmediata', 'Immediate'),
    },
    languages: [
      {
        id: 'lang-1',
        name: 'Español',
        nameI18n: both('Español', 'Spanish'),
        level: both('Nativo', 'Native'),
        detail: both('Lengua materna', 'Mother tongue'),
      },
    ],
    experiences: [EXP_A, EXP_B],
    skillCategories: [
      {
        id: 'cat-1',
        name: both('Backend', 'Backend'),
        skills: [{ id: 'skill-1', name: 'NestJS', tags: ['backend'] }],
      },
    ],
    education: [
      {
        id: 'edu-1',
        institution: 'Universidad',
        startDate: '2008-03',
        endDate: '2013-12',
        inProgress: false,
        visible: true,
        degree: both('Ingeniería', 'Engineering'),
      },
    ],
    certifications: [CERTIFICATION],
    projects: [PROJECT],
    socialLinks: [
      {
        id: 'link-1',
        platform: 'github',
        url: 'https://github.com/ejemplo',
        visible: true,
        label: both('Código abierto', 'Open source'),
        description: both('Repositorios públicos', 'Public repositories'),
      },
    ],
    curatedProfiles: [CURATED],
  };
}

export interface SeededMutation {
  /** Aplica el defecto sobre una copia de la instantánea limpia. */
  readonly mutate: (clean: CvSnapshot) => CvSnapshot;
  readonly entityType: CvEntityType;
  readonly entityId: string;
  readonly field: string | null;
}

const withExperience = (
  s: CvSnapshot,
  id: string,
  changes: Partial<CvExperienceSnapshot>,
): CvSnapshot => ({
  ...s,
  experiences: s.experiences.map((e) => (e.id === id ? { ...e, ...changes } : e)),
});

const withCurated = (s: CvSnapshot, changes: Partial<CvCuratedProfileSnapshot>): CvSnapshot => ({
  ...s,
  curatedProfiles: s.curatedProfiles.map((c) => ({ ...c, ...changes })),
});

/**
 * Una mutación por código. El `Record` hace que agregar un código al catálogo sin su mutación
 * no compile, y `cv-rules.seeded.spec.ts` además lo exige en tiempo de ejecución.
 */
export const SEEDED_MUTATIONS: Record<CvIssueCode, SeededMutation> = {
  'profile.years-mismatch': {
    mutate: (s) =>
      s.profile === null ? s : { ...s, profile: { ...s.profile, yearsOfExperience: 20 } },
    entityType: 'profile',
    entityId: 'profile-1',
    field: 'yearsOfExperience',
  },
  'date.invalid-format': {
    mutate: (s) => withExperience(s, 'exp-b', { startDate: '2024-13' }),
    entityType: 'experience',
    entityId: 'exp-b',
    field: 'startDate',
  },
  'date.end-before-start': {
    mutate: (s) => withExperience(s, 'exp-a', { endDate: '2014-05' }),
    entityType: 'experience',
    entityId: 'exp-a',
    field: 'endDate',
  },
  'date.ongoing-with-end': {
    mutate: (s) => withExperience(s, 'exp-b', { endDate: '2024-05' }),
    entityType: 'experience',
    entityId: 'exp-b',
    field: 'endDate',
  },
  'experience.multiple-current': {
    mutate: (s) => withExperience(s, 'exp-a', { current: true, endDate: null }),
    entityType: 'experience',
    entityId: 'exp-a',
    field: 'current',
  },
  'i18n.missing-translation': {
    mutate: (s) => withExperience(s, 'exp-a', { summary: { es: 'Servicios de backend', en: '' } }),
    entityType: 'experience',
    entityId: 'exp-a',
    field: 'summary',
  },
  'i18n.highlights-count-mismatch': {
    mutate: (s) => withExperience(s, 'exp-a', { highlights: { es: ['Uno', 'Dos'], en: ['One'] } }),
    entityType: 'experience',
    entityId: 'exp-a',
    field: 'highlights',
  },
  'url.invalid': {
    mutate: (s) => ({
      ...s,
      projects: s.projects.map((p) => ({ ...p, url: 'javascript:alert(1)' })),
    }),
    entityType: 'project',
    entityId: 'proj-1',
    field: 'url',
  },
  'url.not-https': {
    mutate: (s) => ({
      ...s,
      socialLinks: s.socialLinks.map((l) => ({ ...l, url: 'http://github.com/ejemplo' })),
    }),
    entityType: 'socialLink',
    entityId: 'link-1',
    field: 'url',
  },
  'certification.expired': {
    mutate: (s) => ({
      ...s,
      certifications: s.certifications.map((c) => ({ ...c, expiresAt: '2025-12' })),
    }),
    entityType: 'certification',
    entityId: 'cert-1',
    field: 'expiresAt',
  },
  'curated.orphan-reference': {
    mutate: (s) => withCurated(s, { excludeIds: ['no-existe'] }),
    entityType: 'curatedProfile',
    entityId: 'cp-1',
    field: 'excludeIds',
  },
  'curated.conflicting-reference': {
    mutate: (s) => withCurated(s, { includeIds: ['exp-a'], excludeIds: ['exp-a'] }),
    entityType: 'curatedProfile',
    entityId: 'cp-1',
    field: 'includeIds',
  },
  'curated.unmatched-filter-tag': {
    mutate: (s) => withCurated(s, { filterTags: ['backend', 'cobol'] }),
    entityType: 'curatedProfile',
    entityId: 'cp-1',
    field: 'filterTags',
  },
  'curated.no-experiences': {
    mutate: (s) => withCurated(s, { excludeIds: ['exp-a', 'exp-b'] }),
    entityType: 'curatedProfile',
    entityId: 'cp-1',
    field: null,
  },
};
