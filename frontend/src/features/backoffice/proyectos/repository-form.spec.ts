import { describe, expect, it } from 'vitest';
import {
  DUPLICATE_REPOSITORY_MESSAGE,
  EMPTY_REPOSITORY,
  GITHUB_URL_MESSAGE,
  parseGithubUrl,
  proposedRepositoryName,
  toRepositoryBody,
  toRepositoryValues,
  validateRepository,
} from './proyectos-form';
import { makeAdminRepository } from '@/test/fixtures/admin';

// add-featured-repositories (D2 y D12): la regla de la URL replica la del backend.
const VALID = {
  ...EMPTY_REPOSITORY,
  name: 'reservas-api',
  url: 'https://github.com/octo-org/reservas-api',
  description: { es: 'API de reservas', en: '' },
};

describe('parseGithubUrl', () => {
  it('devuelve owner y repo de la forma canónica', () => {
    expect(parseGithubUrl('https://github.com/octo-org/api-reservas')).toEqual({
      owner: 'octo-org',
      repo: 'api-reservas',
    });
  });

  it.each([
    'http://github.com/a/b',
    'https://www.github.com/a/b',
    'https://gitlab.com/a/b',
    'https://github.com/a',
    'https://github.com/a/b/',
    'https://github.com/a/b.git',
    'https://github.com/a/b?tab=x',
    'https://github.com/-a/b',
    'https://github.com/a--b/c',
    'https://github.com/a/.',
    'https://github.com/a/..',
    `https://github.com/${'a'.repeat(40)}/r`,
    `https://github.com/a/${'r'.repeat(101)}`,
  ])('rechaza %s', (url) => {
    expect(parseGithubUrl(url)).toBeNull();
  });

  it('acepta un owner de 39 caracteres', () => {
    expect(parseGithubUrl(`https://github.com/${'a'.repeat(39)}/r`)).not.toBeNull();
  });
});

describe('validateRepository', () => {
  it('acepta un repositorio completo', () => {
    expect(validateRepository(VALID)).toEqual({});
  });

  it('una URL inválida da el mensaje literal sobre url', () => {
    expect(validateRepository({ ...VALID, url: 'https://gitlab.com/a/b' })).toEqual({
      url: GITHUB_URL_MESSAGE,
    });
    expect(GITHUB_URL_MESSAGE).toBe(
      'La URL tiene que ser https://github.com/<usuario>/<repositorio>',
    );
    expect(DUPLICATE_REPOSITORY_MESSAGE).toBe('Ese repositorio ya está cargado');
  });

  it('exige nombre (1 a 100), descripción en español y lenguaje de hasta 40', () => {
    expect(validateRepository({ ...VALID, name: '  ' })).toHaveProperty('name');
    expect(validateRepository({ ...VALID, name: 'n'.repeat(101) })).toHaveProperty('name');
    expect(validateRepository({ ...VALID, name: 'n'.repeat(100) })).toEqual({});
    expect(validateRepository({ ...VALID, description: { es: ' ', en: 'x' } })).toHaveProperty(
      'description',
    );
    expect(validateRepository({ ...VALID, language: 'l'.repeat(41) })).toHaveProperty('language');
  });

  it('el orden es un entero no negativo', () => {
    expect(validateRepository({ ...VALID, order: -1 })).toHaveProperty('order');
    expect(validateRepository({ ...VALID, order: 1.5 })).toHaveProperty('order');
  });
});

describe('toRepositoryBody y toRepositoryValues', () => {
  it('recorta, envía el lenguaje vacío como null y no incluye stars', () => {
    const body = toRepositoryBody({ ...VALID, name: ' reservas-api ', url: ` ${VALID.url} ` });
    expect(body).toMatchObject({ name: 'reservas-api', url: VALID.url, language: null });
    expect(body).not.toHaveProperty('stars');
  });

  it('ida y vuelta con un repositorio del panel', () => {
    const repository = makeAdminRepository({ language: null });
    const values = toRepositoryValues(repository);
    expect(values.language).toBe('');
    expect(toRepositoryBody(values)).toMatchObject({
      name: repository.name,
      url: repository.url,
      language: null,
      visible: true,
    });
  });
});

describe('proposedRepositoryName', () => {
  it('propone el segmento repo de una URL válida', () => {
    expect(proposedRepositoryName('https://github.com/octo-org/api-reservas')).toBe('api-reservas');
  });

  it('no propone nada con una URL inválida', () => {
    expect(proposedRepositoryName('https://gitlab.com/octo-org/api')).toBe('');
    expect(proposedRepositoryName('')).toBe('');
  });
});
