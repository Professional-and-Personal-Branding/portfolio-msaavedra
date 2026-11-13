import { ValidationError } from '../../../../shared/domain/errors';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { NewFeaturedRepositoryProps } from '../entities/featured-repository.entity';
import { parseGithubRepositoryUrl } from './parse-github-repository-url';

export const FEATURED_REPOSITORY_NAME_MAX = 100;
export const FEATURED_REPOSITORY_LANGUAGE_MAX = 40;

/**
 * Reglas de dominio de un repositorio destacado (spec `featured-repositories`): nombre de 1 a
 * 100 caracteres sin contar los espacios de los bordes, `language` de hasta 40 y `url` en la
 * forma canónica de GitHub.
 */
export function validateFeaturedRepository(
  props: NewFeaturedRepositoryProps,
): Result<void, ValidationError> {
  const name = props.name.trim();
  if (name.length === 0) {
    return fail(new ValidationError('name es obligatorio', ['name']));
  }
  if (name.length > FEATURED_REPOSITORY_NAME_MAX) {
    return fail(
      new ValidationError(`name admite hasta ${FEATURED_REPOSITORY_NAME_MAX} caracteres`, ['name']),
    );
  }
  if (props.language !== null && props.language.length > FEATURED_REPOSITORY_LANGUAGE_MAX) {
    return fail(
      new ValidationError(`language admite hasta ${FEATURED_REPOSITORY_LANGUAGE_MAX} caracteres`, [
        'language',
      ]),
    );
  }
  const url = parseGithubRepositoryUrl(props.url);
  if (!url.ok) return url;
  return ok(undefined);
}
