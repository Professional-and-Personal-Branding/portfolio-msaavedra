import { projectGithubLanguages, projectGithubRepository } from './project-github-repository';

const FULL = {
  id: 1,
  full_name: 'portafolio-ejemplo-ficticio/reservas-api',
  private: false,
  fork: false,
  archived: false,
  stargazers_count: 12,
  watchers_count: 12,
  open_issues: 4,
  language: 'Java',
  topics: ['Spring-Boot', 'api', 'api', 'PostgreSQL'],
  pushed_at: '2026-10-30T12:00:00Z',
  updated_at: '2026-11-01T09:00:00Z',
  description: 'API de reservas.',
  html_url: 'https://github.com/portafolio-ejemplo-ficticio/reservas-api',
  owner: { login: 'portafolio-ejemplo-ficticio' },
  permissions: { admin: false },
  license: { key: 'mit' },
};

describe('projectGithubRepository', () => {
  it('conserva solo la lista blanca (sin owner, permissions, license ni contadores ajenos)', () => {
    const projected = projectGithubRepository(FULL);
    expect(Object.keys(projected).sort()).toEqual(
      [
        'archived',
        'description',
        'fork',
        'full_name',
        'html_url',
        'language',
        'private',
        'pushed_at',
        'stargazers_count',
        'topics',
      ].sort(),
    );
    expect(projected.stargazers_count).toBe(12);
    expect(projected.language).toBe('Java');
  });

  it('los topics van en minúsculas, sin repetir y hasta 20', () => {
    expect(projectGithubRepository(FULL).topics).toEqual(['spring-boot', 'api', 'postgresql']);
    const many = Array.from({ length: 30 }, (_, i) => `t${i}`);
    expect(projectGithubRepository({ topics: many }).topics).toHaveLength(20);
  });

  it('recorta la descripción a 350 caracteres', () => {
    const projected = projectGithubRepository({ description: 'x'.repeat(500) });
    expect(projected.description).toHaveLength(350);
  });

  it('un tipo inesperado queda nulo sin fallar', () => {
    const projected = projectGithubRepository({
      stargazers_count: '12',
      archived: 'no',
      private: 1,
      pushed_at: 'ayer',
      language: 7,
      topics: 'api',
      description: { es: 'x' },
    });
    expect(projected).toEqual({
      full_name: null,
      private: null,
      fork: null,
      archived: null,
      stargazers_count: null,
      language: null,
      topics: [],
      pushed_at: null,
      description: null,
      html_url: null,
    });
  });

  it.each([null, undefined, 'texto', 42, []])('un cuerpo %p no es un objeto: todo nulo', (body) => {
    expect(projectGithubRepository(body).full_name).toBeNull();
    expect(projectGithubRepository(body).topics).toEqual([]);
  });

  it('no acepta stars negativas ni decimales', () => {
    expect(projectGithubRepository({ stargazers_count: -1 }).stargazers_count).toBeNull();
    expect(projectGithubRepository({ stargazers_count: 1.5 }).stargazers_count).toBeNull();
    expect(projectGithubRepository({ stargazers_count: 0 }).stargazers_count).toBe(0);
  });
});

describe('projectGithubLanguages', () => {
  it('conserva los bytes enteros ≥ 0 y descarta lo demás', () => {
    expect(
      projectGithubLanguages({ Java: 8200, CSS: 1200, Roto: '5', Negativo: -1, Decimal: 1.5 }),
    ).toEqual({ Java: 8200, CSS: 1200 });
  });

  it('se queda con los 20 de más bytes', () => {
    const body = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`L${i}`, i + 1]));
    const projected = projectGithubLanguages(body);
    expect(Object.keys(projected)).toHaveLength(20);
    expect(projected.L24).toBe(25);
    expect(projected.L0).toBeUndefined();
  });

  it('un cuerpo que no es un objeto da un mapa vacío', () => {
    expect(projectGithubLanguages(null)).toEqual({});
    expect(projectGithubLanguages([1, 2])).toEqual({});
  });
});
