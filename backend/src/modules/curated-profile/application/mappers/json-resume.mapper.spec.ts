import {
  loadJsonResumeSchema,
  validateJsonResume,
} from '../../../../../test/support/json-resume-validator';
import { CuratedProfileOutput } from '../dto/curated-profile.output';
import { JSON_RESUME_SCHEMA_URL, toJsonResume } from './json-resume.mapper';

const ALL_SECTIONS = [
  'hero',
  'stats',
  'experience',
  'skills',
  'projects',
  'repositories',
  'education',
  'certifications',
  'presence',
  'contact',
];

function view(overrides: Partial<CuratedProfileOutput> = {}): CuratedProfileOutput {
  return {
    slug: 'ejemplo-backend',
    title: 'Backend',
    headline: 'Ingeniero backend (curado)',
    description: 'Perfil de ejemplo',
    roleType: 'Backend',
    techFocus: 'NestJS',
    layout: 'default',
    visibility: 'PUBLIC',
    updatedAt: '2026-01-15T12:00:00.000Z',
    sections: ALL_SECTIONS,
    hiddenSections: [],
    theme: null,
    profile: {
      id: 'p1',
      fullName: 'Ada Ejemplo',
      headline: 'Ingeniera de software',
      location: 'Santa Cruz de la Sierra, Bolivia',
      timezone: 'America/La_Paz',
      email: 'ada@ejemplo.dev',
      phone: '+591 70000000',
      summary: 'Resumen del perfil.',
      yearsOfExperience: 10,
      availability: { modality: 'remoto', contractType: 'full-time', startDate: 'inmediata' },
      languages: [
        { name: 'Español', level: 'Nativo', detail: 'C2' },
        { name: 'Inglés', level: 'Avanzado', detail: 'C1' },
      ],
    },
    experiences: [
      {
        id: 'e2',
        company: 'Acme',
        role: 'Tech Lead',
        startDate: '2022-03',
        endDate: null,
        current: true,
        location: 'Remoto',
        sector: ['Fintech'],
        summary: 'Lidera el equipo.',
        highlights: ['Redujo la latencia', 'Migró a Kubernetes'],
        technologies: ['NestJS'],
        tags: ['backend'],
        order: 0,
      },
      {
        id: 'e1',
        company: 'Globex',
        role: 'Desarrolladora',
        startDate: '2018',
        endDate: '2022-02',
        current: false,
        location: 'La Paz',
        sector: [],
        summary: '',
        highlights: [],
        technologies: [],
        tags: [],
        order: 1,
      },
    ],
    skillCategories: [
      { name: 'Backend', skills: ['NestJS', 'PostgreSQL'] },
      { name: 'Vacía', skills: [] },
    ],
    projects: [
      {
        id: 'pr1',
        name: 'Portafolio',
        role: 'Autora',
        period: '2019 – 2022',
        summary: 'Un portafolio administrable.',
        technologies: ['React'],
        tags: [],
        url: 'https://ejemplo.dev/portafolio',
        order: 0,
      },
      {
        id: 'pr2',
        name: 'Herramienta interna',
        role: '',
        period: 'Proyecto personal',
        summary: '',
        technologies: [],
        tags: [],
        url: null,
        order: 1,
      },
    ],
    repositories: [],
    education: [
      {
        id: 'ed1',
        degree: 'Ingeniería de Sistemas',
        institution: 'Universidad Ejemplo',
        startDate: '2010',
        endDate: null,
        inProgress: true,
        order: 0,
      },
    ],
    certifications: [
      {
        id: 'c1',
        name: 'Certificación X',
        issuer: 'Emisor',
        year: '2023',
        verificationUrl: 'https://emisor.example/verificar/123',
        credentialId: 'CRED-9981',
        expiresAt: '2026',
        order: 0,
      },
      {
        id: 'c2',
        name: 'Certificación Y',
        issuer: 'Otro',
        year: null,
        verificationUrl: null,
        credentialId: null,
        expiresAt: null,
        order: 1,
      },
    ],
    socialLinks: [
      {
        id: 's1',
        platform: 'GitHub',
        handle: 'ada',
        url: 'https://github.com/ada',
        label: 'GitHub',
        description: '',
        stats: { repos: 3 },
        featured: true,
        order: 0,
      },
    ],
    ...overrides,
  };
}

const CTX = { baseUrl: 'https://ejemplo.dev', locale: 'es' } as const;

function mapAndValidate(output: CuratedProfileOutput) {
  const document = toJsonResume(output, CTX);
  const result = validateJsonResume(document);
  expect(result.errors).toEqual([]);
  return document;
}

/** Claves propias de un valor. */
function keysOf(value: unknown): string[] {
  return Object.keys(value ?? {});
}

interface SchemaNode {
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
}

describe('toJsonResume', () => {
  it('un perfil completo valida contra el schema con formatos activos', () => {
    const document = mapAndValidate(view());
    expect(document.$schema).toBe(JSON_RESUME_SCHEMA_URL);
    expect(document.basics).toEqual({
      name: 'Ada Ejemplo',
      label: 'Ingeniero backend (curado)',
      email: 'ada@ejemplo.dev',
      phone: '+591 70000000',
      url: 'https://ejemplo.dev/ejemplo-backend',
      summary: 'Resumen del perfil.',
      location: { address: 'Santa Cruz de la Sierra, Bolivia' },
      profiles: [{ network: 'GitHub', username: 'ada', url: 'https://github.com/ada' }],
    });
    expect(document.work).toEqual([
      {
        name: 'Acme',
        position: 'Tech Lead',
        location: 'Remoto',
        startDate: '2022-03',
        summary: 'Lidera el equipo.',
        highlights: ['Redujo la latencia', 'Migró a Kubernetes'],
      },
      {
        name: 'Globex',
        position: 'Desarrolladora',
        location: 'La Paz',
        startDate: '2018',
        endDate: '2022-02',
      },
    ]);
    expect(document.education).toEqual([
      { institution: 'Universidad Ejemplo', area: 'Ingeniería de Sistemas', startDate: '2010' },
    ]);
    expect(document.skills).toEqual([{ name: 'Backend', keywords: ['NestJS', 'PostgreSQL'] }]);
    expect(document.languages).toEqual([
      { language: 'Español', fluency: 'Nativo' },
      { language: 'Inglés', fluency: 'Avanzado' },
    ]);
    expect(document.projects).toEqual([
      {
        name: 'Portafolio',
        description: 'Un portafolio administrable.',
        roles: ['Autora'],
        keywords: ['React'],
        startDate: '2019',
        endDate: '2022',
        url: 'https://ejemplo.dev/portafolio',
      },
      { name: 'Herramienta interna' },
    ]);
    expect(document.meta).toEqual({
      canonical: 'https://ejemplo.dev/api/curated-profiles/ejemplo-backend/resume.json?lang=es',
      version: 'v1.0.0',
      lastModified: '2026-01-15T12:00:00',
    });
  });

  it('las certificaciones salen sin `date` y con `url` igual a la verificationUrl', () => {
    const document = mapAndValidate(view());
    expect(document.certificates).toEqual([
      { name: 'Certificación X', issuer: 'Emisor', url: 'https://emisor.example/verificar/123' },
      { name: 'Certificación Y', issuer: 'Otro' },
    ]);
    for (const certificate of document.certificates ?? []) {
      expect(certificate).not.toHaveProperty('date');
    }
  });

  it('una experiencia en curso no tiene endDate', () => {
    const document = mapAndValidate(view());
    expect(document.work?.[0]).not.toHaveProperty('endDate');
    expect(document.education?.[0]).not.toHaveProperty('endDate');
  });

  it('una fecha que no cumple iso8601 se omite', () => {
    const base = view();
    const document = mapAndValidate(
      view({
        experiences: [{ ...base.experiences[0], startDate: 'enero 2020', endDate: '2021-13-45x' }],
      }),
    );
    expect(document.work?.[0]).not.toHaveProperty('startDate');
    expect(document.work?.[0]).not.toHaveProperty('endDate');
  });

  it('una URL inválida se omite en lugar de romper el documento', () => {
    const base = view();
    const document = mapAndValidate(
      view({
        projects: [{ ...base.projects[0], url: 'ejemplo sin esquema' }],
        socialLinks: [{ ...base.socialLinks[0], url: 'no-es-url' }],
      }),
    );
    expect(document.projects?.[0]).not.toHaveProperty('url');
    expect(document.basics.profiles).toEqual([{ network: 'GitHub', username: 'ada' }]);
  });

  it('con `contact` oculto no hay email, phone ni languages, y sí name', () => {
    const document = mapAndValidate(
      view({
        sections: ALL_SECTIONS.filter((id) => id !== 'contact'),
        hiddenSections: ['contact'],
      }),
    );
    expect(document.basics).not.toHaveProperty('email');
    expect(document.basics).not.toHaveProperty('phone');
    expect(document).not.toHaveProperty('languages');
    expect(document.basics.name).toBe('Ada Ejemplo');
  });

  it('con `presence` oculto no hay basics.profiles', () => {
    const document = mapAndValidate(
      view({ sections: ALL_SECTIONS.filter((id) => id !== 'presence') }),
    );
    expect(document.basics).not.toHaveProperty('profiles');
    expect(document.work).toBeDefined();
  });

  it('con `hero` oculto basics sigue completo', () => {
    const document = mapAndValidate(view({ sections: ALL_SECTIONS.filter((id) => id !== 'hero') }));
    expect(document.basics).toMatchObject({
      name: 'Ada Ejemplo',
      label: 'Ingeniero backend (curado)',
      url: 'https://ejemplo.dev/ejemplo-backend',
      summary: 'Resumen del perfil.',
    });
  });

  it('una sección fuera de `sections` no sale aunque tenga datos', () => {
    const document = mapAndValidate(
      view({ sections: ['hero', 'experience'], hiddenSections: ['projects', 'skills'] }),
    );
    expect(keysOf(document)).toEqual(['$schema', 'basics', 'work', 'meta']);
  });

  describe('repositorios destacados como proyectos (change add-featured-repositories, D10)', () => {
    const repo = (
      id: string,
      overrides: Partial<CuratedProfileOutput['repositories'][number]> = {},
    ): CuratedProfileOutput['repositories'][number] => ({
      id,
      name: `repo-${id}`,
      url: `https://github.com/octo-org/repo-${id}`,
      language: 'Java',
      description: `Descripción ${id}`,
      technologies: ['Spring Boot', 'PostgreSQL'],
      tags: ['java'],
      order: 0,
      evidence: null,
      ...overrides,
    });
    const TWO = [repo('a'), repo('b', { language: null, technologies: ['Go'] })];

    it('van después de los proyectos con type repository, sin fechas ni roles', () => {
      const document = mapAndValidate(view({ repositories: TWO }));
      expect(document.projects).toHaveLength(4);
      expect(document.projects?.slice(0, 2).map((p) => p.name)).toEqual([
        'Portafolio',
        'Herramienta interna',
      ]);
      expect(document.projects?.slice(2)).toEqual([
        {
          name: 'repo-a',
          description: 'Descripción a',
          keywords: ['Java', 'Spring Boot', 'PostgreSQL'],
          url: 'https://github.com/octo-org/repo-a',
          type: 'repository',
        },
        {
          name: 'repo-b',
          description: 'Descripción b',
          keywords: ['Go'],
          url: 'https://github.com/octo-org/repo-b',
          type: 'repository',
        },
      ]);
    });

    it('el lenguaje que ya está en las tecnologías no se repite ni se mueve', () => {
      const document = mapAndValidate(
        view({
          projects: [],
          repositories: [
            repo('a', { language: 'java', technologies: ['Spring Boot', 'Java'] }),
            repo('b'),
          ],
        }),
      );
      expect(document.projects?.[0].keywords).toEqual(['Spring Boot', 'Java']);
    });

    it('con projects oculta y repositories visible, projects trae solo los repos', () => {
      const document = mapAndValidate(
        view({
          repositories: TWO,
          sections: ALL_SECTIONS.filter((id) => id !== 'projects'),
          hiddenSections: ['projects'],
        }),
      );
      expect(document.projects?.map((p) => p.type)).toEqual(['repository', 'repository']);
    });

    it('con 1 repo la sección no está en sections: no se exportan', () => {
      const document = mapAndValidate(
        view({
          repositories: [repo('a')],
          sections: ALL_SECTIONS.filter((id) => id !== 'repositories'),
        }),
      );
      expect(document.projects?.map((p) => p.name)).toEqual(['Portafolio', 'Herramienta interna']);
    });

    it('con repositories oculta no se exportan aunque haya datos', () => {
      const document = mapAndValidate(
        view({
          repositories: TWO,
          sections: ALL_SECTIONS.filter((id) => id !== 'repositories'),
          hiddenSections: ['repositories'],
        }),
      );
      expect(document.projects?.some((p) => p.type === 'repository')).toBe(false);
    });

    it('ninguna de las dos secciones: la clave projects no sale', () => {
      const document = mapAndValidate(
        view({
          repositories: TWO,
          sections: ['hero', 'experience'],
        }),
      );
      expect(document).not.toHaveProperty('projects');
    });

    it('no viajan stars, tags ni el lenguaje como campo propio', () => {
      const serialized = JSON.stringify(
        toJsonResume(view({ repositories: TWO }), CTX).projects?.slice(2),
      );
      expect(serialized).not.toMatch(/stars|tags|language|visible/);
    });
  });

  it('una sección sin datos no deja su clave', () => {
    const document = mapAndValidate(view({ projects: [], skillCategories: [] }));
    expect(document).not.toHaveProperty('projects');
    expect(document).not.toHaveProperty('skills');
  });

  it('con profile null, basics lleva solo url', () => {
    const document = mapAndValidate(view({ profile: null }));
    expect(document.basics).toEqual({ url: 'https://ejemplo.dev/ejemplo-backend' });
    expect(document).not.toHaveProperty('languages');
  });

  it('phone null no emite phone', () => {
    const base = view();
    const document = mapAndValidate(
      view({ profile: base.profile ? { ...base.profile, phone: null } : null }),
    );
    expect(document.basics).not.toHaveProperty('phone');
  });

  it('un headline curado vacío cae al del perfil', () => {
    const document = mapAndValidate(view({ headline: '' }));
    expect(document.basics.label).toBe('Ingeniera de software');
  });

  it('updatedAt null no emite lastModified', () => {
    const document = mapAndValidate(view({ updatedAt: null }));
    expect(document.meta).not.toHaveProperty('lastModified');
  });

  it('lastModified es UTC sin milisegundos ni Z', () => {
    const document = mapAndValidate(view({ updatedAt: '2026-01-15T23:59:59.999Z' }));
    expect(document.meta.lastModified).toBe('2026-01-15T23:59:59');
  });

  it('el perfil de la home (`all`) tiene basics.url con barra final y canonical propio', () => {
    const document = mapAndValidate(view({ slug: 'all' }));
    expect(document.basics.url).toBe('https://ejemplo.dev/');
    expect(document.meta.canonical).toBe(
      'https://ejemplo.dev/api/curated-profiles/all/resume.json?lang=es',
    );
  });

  it('baseUrl con barra final no duplica barras y el canonical sigue el idioma', () => {
    const document = toJsonResume(view(), { baseUrl: 'https://ejemplo.dev/', locale: 'en' });
    expect(document.basics.url).toBe('https://ejemplo.dev/ejemplo-backend');
    expect(document.meta.canonical).toBe(
      'https://ejemplo.dev/api/curated-profiles/ejemplo-backend/resume.json?lang=en',
    );
  });

  it('las claves de raíz salen en el orden fijo', () => {
    const document = mapAndValidate(view());
    expect(keysOf(document)).toEqual([
      '$schema',
      'basics',
      'work',
      'education',
      'certificates',
      'skills',
      'languages',
      'projects',
      'meta',
    ]);
  });

  it('no hay strings vacíos, null ni listas vacías', () => {
    const base = view();
    const document = mapAndValidate(
      view({
        profile: base.profile ? { ...base.profile, summary: '', location: '', phone: '' } : null,
        experiences: [{ ...base.experiences[1] }],
      }),
    );
    const visit = (value: unknown, path: string): void => {
      if (value === null) throw new Error(`null en ${path}`);
      if (value === '') throw new Error(`string vacío en ${path}`);
      if (Array.isArray(value)) {
        if (value.length === 0) throw new Error(`lista vacía en ${path}`);
        value.forEach((item, index) => visit(item, `${path}[${index}]`));
      } else if (typeof value === 'object') {
        for (const [key, item] of Object.entries(value)) visit(item, `${path}.${key}`);
      }
    };
    visit(document, '$');
  });

  it('ninguna clave queda fuera de las properties del schema', () => {
    const document = toJsonResume(view(), CTX);
    const schema = loadJsonResumeSchema() as unknown as SchemaNode;
    const root = schema.properties ?? {};
    const node = (name: string): SchemaNode => root[name] ?? {};
    const itemKeys = (name: string): string[] => keysOf(node(name).items?.properties);

    expect(keysOf(root)).toEqual(expect.arrayContaining(keysOf(document)));
    expect(keysOf(node('basics').properties)).toEqual(
      expect.arrayContaining(keysOf(document.basics)),
    );
    expect(keysOf(node('meta').properties)).toEqual(expect.arrayContaining(keysOf(document.meta)));
    expect(keysOf(node('basics').properties?.profiles?.items?.properties)).toEqual(
      expect.arrayContaining(keysOf(document.basics.profiles?.[0])),
    );
    const lists = {
      work: document.work,
      education: document.education,
      certificates: document.certificates,
      skills: document.skills,
      languages: document.languages,
      projects: document.projects,
    };
    for (const [name, entries] of Object.entries(lists)) {
      expect(entries?.length ?? 0).toBeGreaterThan(0);
      for (const entry of entries ?? []) {
        expect(itemKeys(name)).toEqual(expect.arrayContaining(keysOf(entry)));
      }
    }
  });

  it('no viajan campos propios del portafolio (tema, tags, credencial, stats)', () => {
    const serialized = JSON.stringify(toJsonResume(view(), CTX));
    for (const ajeno of [
      'credentialId',
      'expiresAt',
      'filterTags',
      'tags',
      'stats',
      'themeOverrides',
      'detail',
    ]) {
      expect(serialized).not.toContain(`"${ajeno}"`);
    }
    expect(serialized).not.toContain('CRED-9981');
  });
});
