import { ValidationError } from '../../../../shared/domain/errors';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { NewExperienceProps } from '../entities/experience.entity';

export const YEAR_MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Reglas de dominio de una experiencia (spec `admin-experience-crud`):
 * fechas YYYY-MM, `current` excluye `endDate`, `startDate <= endDate`.
 */
export function validateExperience(props: NewExperienceProps): Result<void, ValidationError> {
  if (!YEAR_MONTH_REGEX.test(props.startDate)) {
    return fail(new ValidationError('startDate debe tener formato YYYY-MM', ['startDate']));
  }
  if (props.endDate !== null && !YEAR_MONTH_REGEX.test(props.endDate)) {
    return fail(new ValidationError('endDate debe tener formato YYYY-MM', ['endDate']));
  }
  if (props.current && props.endDate !== null) {
    return fail(
      new ValidationError('Una experiencia actual no puede tener endDate', ['current', 'endDate']),
    );
  }
  if (props.endDate !== null && props.startDate > props.endDate) {
    return fail(
      new ValidationError('startDate no puede ser posterior a endDate', ['startDate', 'endDate']),
    );
  }
  if (props.company.trim().length === 0) {
    return fail(new ValidationError('company es obligatorio', ['company']));
  }
  return ok(undefined);
}
