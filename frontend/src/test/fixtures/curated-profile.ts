import type { CuratedProfile, CuratedProfileSummary, Experience } from '@/shared/types/portfolio';

/** Datos ficticios con la forma exacta del contrato (solo para tests). */
export function makeExperience(overrides: Partial<Experience> = {}): Experience {
  return {
    id: 'exp-1',
    company: 'Acme Corp',
    role: 'Senior Backend Engineer',
    startDate: '2022-03-01',
    endDate: null,
    current: true,
    location: 'Remoto',
    sector: ['Fintech'],
    summary: 'Diseño de servicios de pagos.',
    highlights: ['Redujo latencia 40 %'],
    technologies: ['TypeScript', 'NestJS', 'PostgreSQL'],
    tags: ['nodejs', 'nestjs'],
    order: 1,
    ...overrides,
  };
}

export function makeCuratedProfile(overrides: Partial<CuratedProfile> = {}): CuratedProfile {
  return {
    slug: 'all',
    title: 'Perfil completo',
    headline: 'Ingeniero de software',
    description: 'Vista completa de la trayectoria.',
    roleType: 'Generalista',
    techFocus: 'Polyglot',
    accentColor: '#38bdf8',
    layout: 'classic',
    visibility: 'PUBLIC',
    // Lo que devuelve el backend para un perfil con datos en todo: el catálogo completo.
    sections: [
      'hero',
      'stats',
      'experience',
      'skills',
      'projects',
      'education',
      'certifications',
      'presence',
      'contact',
    ],
    hiddenSections: [],
    theme: {
      slug: 'modern-dark',
      name: 'Modern Dark',
      isPreset: true,
      tokens: { mode: 'dark', colors: { accent: '#38bdf8' } },
    },
    profile: {
      id: 'profile-1',
      fullName: 'Ada Ejemplo',
      headline: 'Ingeniera de software',
      location: 'La Paz, Bolivia',
      timezone: 'GMT-4',
      email: 'ada@example.com',
      phone: '+591 70000000',
      summary: 'Más de una década construyendo sistemas.',
      yearsOfExperience: 10,
      availability: { modality: 'Remoto', contractType: 'Freelance', startDate: 'Inmediata' },
      languages: [{ name: 'Español', level: 'Nativo', detail: 'Oral y escrito' }],
    },
    experiences: [
      makeExperience(),
      makeExperience({
        id: 'exp-2',
        company: 'Globex',
        role: 'Backend Developer',
        startDate: '2019-01-01',
        endDate: '2022-02-28',
        current: false,
        technologies: ['Java', 'Spring Boot', 'PostgreSQL'],
        order: 2,
      }),
    ],
    skillCategories: [
      { name: 'Lenguajes', skills: ['TypeScript', 'Java'] },
      { name: 'Bases de datos', skills: ['PostgreSQL'] },
    ],
    projects: [
      {
        id: 'proj-1',
        name: 'Portafolio',
        role: 'Autor',
        period: '2026',
        summary: 'Portafolio administrable.',
        technologies: ['React', 'NestJS'],
        tags: ['fullstack'],
        url: 'https://example.com',
        order: 1,
      },
    ],
    education: [
      {
        id: 'edu-1',
        degree: 'Ingeniería de Sistemas',
        institution: 'Universidad Ejemplo',
        startDate: '2010-02-01',
        endDate: '2015-12-01',
        inProgress: false,
        order: 1,
      },
    ],
    certifications: [
      { id: 'cert-1', name: 'AWS Solutions Architect', issuer: 'AWS', year: '2023', order: 1 },
      { id: 'cert-2', name: 'Scrum Master', issuer: 'Scrum.org', year: null, order: 2 },
    ],
    socialLinks: [
      {
        id: 'sl-1',
        platform: 'github',
        handle: 'ada',
        url: 'https://github.com/ada',
        label: 'Código abierto',
        description: 'Repositorios públicos.',
        stats: { repos: 42 },
        featured: true,
        order: 1,
      },
      {
        id: 'sl-2',
        platform: 'linkedin',
        handle: 'ada-ejemplo',
        url: 'https://linkedin.com/in/ada-ejemplo',
        label: 'Perfil profesional',
        description: 'Red profesional.',
        stats: null,
        featured: true,
        order: 2,
      },
    ],
    ...overrides,
  };
}

const ROLE_TYPES = [
  'Backend',
  'Fullstack',
  'DevOps',
  'Arquitecto',
  'Liderazgo',
  'Tech Lead',
  'Generalista',
];

/** 14 resúmenes (13 plantillas + `all`) repartidos en 7 `roleType`. */
export function makeCuratedProfileList(): CuratedProfileSummary[] {
  return Array.from({ length: 14 }, (_, i) => {
    // El perfil `all` del seed no tiene roleType (cadena vacía).
    const roleType = i === 0 ? '' : (ROLE_TYPES[i % ROLE_TYPES.length] ?? 'Backend');
    return {
      slug: i === 0 ? 'all' : `perfil-${i}`,
      title: i === 0 ? 'Perfil completo' : `Perfil ${i}`,
      headline: `Headline ${i}`,
      description: `Descripción ${i}`,
      roleType,
      techFocus: i === 0 ? 'Polyglot' : `Tech ${i}`,
      accentColor: '#38bdf8',
      layout: 'classic',
    };
  });
}
