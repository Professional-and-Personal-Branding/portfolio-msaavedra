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
    accentColor: '#1A365D',
    themeId: 'theme-dark',
    themeOverrides: null,
    layout: 'classic',
    sectionsOrder: ['hero', 'stats', 'experience', 'skills', 'contact'],
    sectionsHidden: [],
    visibility: 'PUBLIC',
    accessToken: null,
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
};

export const EMPTY_ANALYTICS: ProfileViews = {
  from: '2026-08-10',
  to: '2026-09-08',
  total: 0,
  byProfile: [],
  byLocale: [],
  byDay: [],
};
