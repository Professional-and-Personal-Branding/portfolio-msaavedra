import type {
  AdminCuratedProfile,
  AdminExperience,
  AdminSkillCategory,
  AdminTheme,
  ProfileViews,
} from '@/features/backoffice/shared/admin-types';
import type { components } from '@/shared/types/api';

export const ADMIN: components['schemas']['AdminResponse'] = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Ada Administradora',
};

export function makeAdminExperience(overrides: Partial<AdminExperience> = {}): AdminExperience {
  return {
    id: 'exp-1',
    company: 'Acme Corp',
    role: { es: 'Backend Senior', en: 'Senior Backend' },
    startDate: '2022-03',
    endDate: null,
    current: true,
    location: 'Remoto',
    summary: { es: 'Servicios de pagos.', en: 'Payment services.' },
    highlights: { es: ['Redujo latencia'], en: ['Reduced latency'] },
    technologies: ['TypeScript', 'NestJS'],
    tags: ['nodejs', 'nestjs'],
    sector: ['fintech'],
    order: 0,
    visible: true,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

export const ADMIN_EXPERIENCES: AdminExperience[] = [
  makeAdminExperience(),
  makeAdminExperience({
    id: 'exp-2',
    company: 'Globex',
    role: { es: 'Desarrollador Java', en: 'Java Developer' },
    startDate: '2019-01',
    endDate: '2022-02',
    current: false,
    technologies: ['Java'],
    tags: ['java'],
    order: 1,
  }),
  makeAdminExperience({
    id: 'exp-3',
    company: 'Initech',
    role: { es: 'Analista', en: 'Analyst' },
    startDate: '2016-01',
    endDate: '2018-12',
    current: false,
    tags: ['legacy'],
    visible: false,
    order: 2,
  }),
];

export const ADMIN_CATEGORIES: AdminSkillCategory[] = [
  {
    id: 'cat-1',
    name: { es: 'Lenguajes', en: 'Languages' },
    order: 0,
    skills: [
      { id: 'sk-1', categoryId: 'cat-1', name: 'TypeScript', tags: ['nodejs'], order: 0 },
      { id: 'sk-2', categoryId: 'cat-1', name: 'Java', tags: ['java'], order: 1 },
    ],
  },
  {
    id: 'cat-2',
    name: { es: 'Metodologías', en: 'Methodologies' },
    order: 1,
    skills: [{ id: 'sk-3', categoryId: 'cat-2', name: 'Scrum', tags: ['leadership'], order: 0 }],
  },
];

export function makeAdminCuratedProfile(
  overrides: Partial<AdminCuratedProfile> = {},
): AdminCuratedProfile {
  return {
    id: 'cp-1',
    slug: 'acme-backend',
    title: { es: 'Backend en Acme', en: 'Backend at Acme' },
    headline: { es: 'Titular', en: 'Headline' },
    description: null,
    roleType: { es: 'Backend', en: 'Backend' },
    techFocus: 'Node',
    filterTags: ['nodejs'],
    includeIds: [],
    excludeIds: [],
    themeId: 'theme-dark',
    themeOverrides: null,
    layout: 'classic',
    sectionsOrder: ['hero', 'stats', 'experience', 'skills', 'contact'],
    sectionsHidden: [],
    visibility: 'PUBLIC',
    accessToken: null,
    listed: true,
    archivedAt: null,
    views: 12,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

export const ADMIN_THEMES: AdminTheme[] = [
  {
    id: 'theme-dark',
    slug: 'modern-dark',
    name: 'Modern Dark',
    isPreset: true,
    tokens: {
      mode: 'dark',
      colors: {
        bg: '#0a0e1a',
        bgSoft: '#111827',
        card: '#161d2e',
        border: '#252d42',
        text: '#e8edf5',
        textMuted: '#94a3b8',
        accent: '#38bdf8',
        accent2: '#818cf8',
      },
      typography: { fontSans: 'Inter', fontHeading: 'Inter', scale: 'default' },
      layout: { radius: '16px', maxWidth: '1080px', density: 'comfortable' },
      effects: { animations: true, glassmorphism: true },
    },
  },
  {
    id: 'theme-elegant',
    slug: 'elegant',
    name: 'Elegant',
    isPreset: true,
    tokens: {
      mode: 'dark',
      colors: {
        bg: '#1a1814',
        bgSoft: '#221f1a',
        card: '#28241d',
        border: '#3a342a',
        text: '#f0ebe0',
        textMuted: '#b8ae9c',
        accent: '#c8a04e',
        accent2: '#e0c084',
      },
      typography: { fontSans: 'Georgia', fontHeading: 'Georgia', scale: 'default' },
      layout: { radius: '12px', maxWidth: '1000px', density: 'comfortable' },
      effects: { animations: true, glassmorphism: false },
    },
  },
];

export const ANALYTICS: ProfileViews = {
  from: '2026-08-10',
  to: '2026-09-08',
  total: 12,
  byProfile: [
    { slug: 'acme-backend', views: 3 },
    { slug: 'all', views: 9 },
  ],
  byLocale: [
    { locale: 'es', views: 8 },
    { locale: 'en', views: 4 },
  ],
  byDay: [
    { day: '2026-09-06', views: 1 },
    { day: '2026-09-07', views: 5 },
    { day: '2026-09-08', views: 2 },
  ],
  byReferrer: [
    { referrer: 'directo', views: 7 },
    { referrer: 'linkedin.com', views: 5 },
  ],
  byKind: [
    { kind: 'HUMAN', views: 12 },
    { kind: 'OWNER', views: 3 },
    { kind: 'BOT', views: 5 },
  ],
};

export const EMPTY_ANALYTICS: ProfileViews = {
  from: '2026-08-10',
  to: '2026-09-08',
  total: 0,
  byProfile: [],
  byLocale: [],
  byDay: [],
  byReferrer: [],
  byKind: [
    { kind: 'HUMAN', views: 0 },
    { kind: 'OWNER', views: 0 },
    { kind: 'BOT', views: 0 },
  ],
};

// add-profile-content-admin: formación (educación y certificaciones).
type AdminEducationFixture = components['schemas']['AdminEducationResponse'];
type AdminCertificationFixture = components['schemas']['AdminCertificationResponse'];

export function makeAdminEducation(
  overrides: Partial<AdminEducationFixture> = {},
): AdminEducationFixture {
  return {
    id: 'edu-1',
    degree: { es: 'Ingeniería de Sistemas', en: 'Systems Engineering' },
    institution: 'Universidad Nacional',
    startDate: '2010-03',
    endDate: '2015-12',
    inProgress: false,
    order: 0,
    visible: true,
    ...overrides,
  };
}

export const ADMIN_EDUCATION: AdminEducationFixture[] = [
  makeAdminEducation(),
  makeAdminEducation({
    id: 'edu-2',
    degree: { es: 'Maestría en Arquitectura de Software' },
    institution: 'Instituto Tecnológico',
    startDate: '2024',
    endDate: null,
    inProgress: true,
    order: 1,
    visible: false,
  }),
];

export function makeAdminCertification(
  overrides: Partial<AdminCertificationFixture> = {},
): AdminCertificationFixture {
  return {
    id: 'cert-1',
    name: { es: 'Scrum Master', en: 'Scrum Master' },
    issuer: 'Scrum Alliance',
    year: '2021',
    order: 0,
    visible: true,
    ...overrides,
  };
}

export const ADMIN_CERTIFICATIONS: AdminCertificationFixture[] = [
  makeAdminCertification(),
  makeAdminCertification({
    id: 'cert-2',
    name: { es: 'Arquitecto Cloud', en: 'Cloud Architect' },
    issuer: 'Nube S.A.',
    year: null,
    order: 1,
  }),
];

// ── Proyectos destacados y enlaces sociales (add-profile-content-admin) ────
type AdminProjectFixture = components['schemas']['AdminProjectResponse'];
type AdminSocialLinkFixture = components['schemas']['AdminSocialLinkResponse'];

export function makeAdminProject(
  overrides: Partial<AdminProjectFixture> = {},
): AdminProjectFixture {
  return {
    id: 'proj-1',
    name: 'Portafolio Administrable',
    role: { es: 'Autor', en: 'Author' },
    period: '2026',
    summary: { es: 'Portafolio con perfiles curados.', en: 'Portfolio with curated profiles.' },
    technologies: ['NestJS', 'React'],
    tags: ['nodejs', 'react'],
    url: null,
    order: 0,
    visible: true,
    ...overrides,
  };
}

export const ADMIN_PROJECTS: AdminProjectFixture[] = [
  makeAdminProject(),
  makeAdminProject({
    id: 'proj-2',
    name: 'Bot de Pagos',
    role: { es: 'Líder técnico', en: 'Tech lead' },
    period: '2019-2020',
    technologies: ['Java'],
    tags: ['java'],
    url: 'https://github.com/acme/pagos',
    order: 1,
    visible: false,
  }),
];

export function makeAdminSocialLink(
  overrides: Partial<AdminSocialLinkFixture> = {},
): AdminSocialLinkFixture {
  return {
    id: 'sl-1',
    platform: 'github',
    handle: 'ada',
    url: 'https://github.com/ada',
    label: { es: 'GitHub', en: 'GitHub' },
    description: { es: 'Código abierto', en: 'Open source' },
    stats: { repos: 67 },
    featured: true,
    order: 0,
    visible: true,
    ...overrides,
  };
}

export const ADMIN_SOCIAL_LINKS: AdminSocialLinkFixture[] = [
  makeAdminSocialLink(),
  makeAdminSocialLink({
    id: 'sl-2',
    platform: 'youtube',
    handle: 'ada-tv',
    url: 'https://youtube.com/@ada-tv',
    label: { es: 'YouTube', en: 'YouTube' },
    description: null,
    stats: null,
    featured: false,
    order: 1,
    visible: false,
  }),
];
