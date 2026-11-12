import {
  githubRepositoryKey,
  githubRepositoryKeyOf,
  parseGithubRepositoryUrl,
} from './parse-github-repository-url';

describe('parseGithubRepositoryUrl', () => {
  it('acepta la forma canónica y devuelve owner y repo', () => {
    const result = parseGithubRepositoryUrl('https://github.com/octo-org/api-reservas');
    expect(result).toEqual({ ok: true, value: { owner: 'octo-org', repo: 'api-reservas' } });
  });

  it.each([
    'https://github.com/a/b',
    'https://github.com/a/.github',
    'https://github.com/a/b.c_d-e',
    'https://github.com/a/...',
    'https://github.com/a-b-c/repo',
    `https://github.com/${'a'.repeat(39)}/r`,
    `https://github.com/a/${'r'.repeat(100)}`,
  ])('acepta %s', (url) => {
    expect(parseGithubRepositoryUrl(url).ok).toBe(true);
  });

  it.each([
    'http://github.com/a/b',
    'https://www.github.com/a/b',
    'https://gitlab.com/a/b',
    'https://github.com:443/a/b',
    'https://user@github.com/a/b',
    'https://github.com/a',
    'https://github.com/a/b/',
    'https://github.com/a/b/c',
    'https://github.com/a/b.git',
    'https://github.com/a/b?tab=x',
    'https://github.com/a/b#readme',
    'https://github.com/-a/b',
    'https://github.com/a-/b',
    'https://github.com/a--b/c',
    'https://github.com/a_b/c',
    `https://github.com/${'a'.repeat(40)}/r`,
    `https://github.com/a/${'r'.repeat(101)}`,
    'https://github.com/a/.',
    'https://github.com/a/..',
    'https://github.com//b',
    ' https://github.com/a/b',
    'https://github.com/a/b ',
    'github.com/a/b',
    '',
  ])('rechaza %j con error sobre url', (url) => {
    const result = parseGithubRepositoryUrl(url);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.fields).toEqual(['url']);
  });

  it('la clave de unicidad no distingue mayúsculas', () => {
    expect(githubRepositoryKey('Octo-Org', 'API-Reservas')).toBe('octo-org/api-reservas');
    expect(githubRepositoryKeyOf('https://github.com/Octo-Org/API-Reservas')).toBe(
      'octo-org/api-reservas',
    );
    expect(githubRepositoryKeyOf('https://gitlab.com/a/b')).toBeNull();
  });
});
