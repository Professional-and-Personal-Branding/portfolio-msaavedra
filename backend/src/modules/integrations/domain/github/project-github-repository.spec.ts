import {
  projectGithubLanguages,
  projectGithubRepository,
  wellFormed,
} from './project-github-repository';

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

describe('saneamiento de strings remotos y conteos (revisión de seguridad M1 y B1)', () => {
  const EMOJI = '\u{1F600}';

  it('un emoji justo en el borde del corte no deja un surrogate suelto', () => {
    // 349 caracteres + un emoji (2 unidades UTF-16): slice por unidades lo partiría.
    const description = 'a'.repeat(349) + EMOJI + 'zzz';
    const out = projectGithubRepository({ description }).description as string;
    expect(Array.from(out)).toHaveLength(350);
    expect(out.endsWith(EMOJI)).toBe(true);
    expect(out).toBe(out.normalize()); // cadena válida
    expect(/[\uD800-\uDFFF]/.test(out.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ''))).toBe(false);
    expect(JSON.stringify(out)).toBe(JSON.stringify(out.toString()));
  });

  it('wellFormed reemplaza surrogates sueltos y quita NUL', () => {
    expect(wellFormed('a\uD83Db')).toBe('a�b');
    expect(wellFormed('a\uDE00b')).toBe('a�b');
    expect(wellFormed('a\u0000b')).toBe('ab');
    expect(wellFormed(`x${EMOJI}y`)).toBe(`x${EMOJI}y`);
  });

  it('aplica el saneamiento a descripción, topics, lenguaje y nombres de lenguajes', () => {
    const bad = 'ab\uD83D';
    const repo = projectGithubRepository({
      description: bad,
      topics: [bad],
      language: bad,
    });
    expect(repo.description).toBe('ab�');
    expect(repo.topics).toEqual(['ab�']);
    expect(repo.language).toBe('ab�');
    expect(projectGithubLanguages({ [bad]: 10 })).toEqual({ 'ab�': 10 });
  });

  it('acota stars y bytes a 2^31-1 (columna INTEGER)', () => {
    expect(projectGithubRepository({ stargazers_count: 5_000_000_000 }).stargazers_count).toBe(
      2_147_483_647,
    );
    expect(projectGithubLanguages({ Java: 9_999_999_999 })).toEqual({ Java: 2_147_483_647 });
  });

  it('acota cada topic y cada nombre de lenguaje a 50 code points', () => {
    const long = EMOJI.repeat(80);
    const repo = projectGithubRepository({ topics: [long] });
    expect(Array.from(repo.topics[0])).toHaveLength(50);
    const names = Object.keys(projectGithubLanguages({ [long]: 1 }));
    expect(Array.from(names[0])).toHaveLength(50);
  });
});
