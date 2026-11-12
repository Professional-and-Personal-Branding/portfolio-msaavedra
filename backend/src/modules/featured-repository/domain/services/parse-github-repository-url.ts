import { ValidationError } from '../../../../shared/domain/errors';
import { fail, ok, Result } from '../../../../shared/domain/result';

export interface GithubRepositoryRef {
  readonly owner: string;
  readonly repo: string;
}

/** Forma esperada, tal como se muestra en los mensajes de error (panel y API). */
export const GITHUB_REPOSITORY_URL_MESSAGE =
  'La URL tiene que ser https://github.com/<usuario>/<repositorio>';

/**
 * Forma canónica de la URL (change `add-featured-repositories`, D2): `https`, host `github.com`
 * exacto, `owner` de 1 a 39 alfanuméricos o guiones simples sin guion en los bordes y `repo`
 * de 1 a 100 de `[A-Za-z0-9._-]`. La reutiliza el DTO (`@Matches`); los casos que la regex no
 * cubre (`.`, `..` y `.git` final) los decide `parseGithubRepositoryUrl`.
 */
export const GITHUB_REPOSITORY_URL_REGEX =
  /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38})\/([A-Za-z0-9._-]{1,100})$/;

/**
 * Valida la URL de un repositorio de GitHub y devuelve `owner` y `repo`. No normaliza nada:
 * un valor fuera de forma es un error de validación sobre `url`.
 */
export function parseGithubRepositoryUrl(
  value: string,
): Result<GithubRepositoryRef, ValidationError> {
  const match = GITHUB_REPOSITORY_URL_REGEX.exec(value);
  if (match) {
    const [, owner, repo] = match;
    if (repo !== '.' && repo !== '..' && !repo.endsWith('.git')) {
      return ok({ owner, repo });
    }
  }
  return fail(new ValidationError(GITHUB_REPOSITORY_URL_MESSAGE, ['url']));
}

/** Clave de unicidad de un repositorio: `owner/repo` en minúsculas. */
export function githubRepositoryKey(owner: string, repo: string): string {
  return `${owner}/${repo}`.toLowerCase();
}

/** Clave de una URL ya válida; `null` si no lo es. */
export function githubRepositoryKeyOf(url: string): string | null {
  const parsed = parseGithubRepositoryUrl(url);
  return parsed.ok ? githubRepositoryKey(parsed.value.owner, parsed.value.repo) : null;
}
