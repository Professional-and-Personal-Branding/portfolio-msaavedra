import { ValidationError } from '../../../../shared/domain/errors';
import { isHttpUrl } from '../../../../shared/domain/http-url';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { NewProjectProps } from '../entities/project.entity';

/**
 * Reglas de dominio de un proyecto (spec `admin-content-management`): nombre y
 * período no vacíos, y `url` absoluta http(s) si viene.
 */
export function validateProject(props: NewProjectProps): Result<void, ValidationError> {
  if (props.name.trim().length === 0) {
    return fail(new ValidationError('name es obligatorio', ['name']));
  }
  if (props.period.trim().length === 0) {
    return fail(new ValidationError('period es obligatorio', ['period']));
  }
  if (props.url !== null && !isHttpUrl(props.url)) {
    return fail(new ValidationError('url debe ser una URL http(s) absoluta', ['url']));
  }
  return ok(undefined);
}
