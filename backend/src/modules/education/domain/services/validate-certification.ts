import { ValidationError } from '../../../../shared/domain/errors';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { NewCertificationProps } from '../entities/certification.entity';
import { hasSourceText } from './validate-education';

export const YEAR_REGEX = /^\d{4}$/;

/**
 * Reglas de dominio de una certificación (spec `admin-content-management`):
 * emisor y nombre (`es`) no vacíos, `year` YYYY o null.
 */
export function validateCertification(props: NewCertificationProps): Result<void, ValidationError> {
  if (props.issuer.trim().length === 0) {
    return fail(new ValidationError('issuer es obligatorio', ['issuer']));
  }
  if (!hasSourceText(props.name)) {
    return fail(new ValidationError('name.es es obligatorio', ['name']));
  }
  if (props.year !== null && !YEAR_REGEX.test(props.year)) {
    return fail(new ValidationError('year debe tener formato YYYY', ['year']));
  }
  return ok(undefined);
}
