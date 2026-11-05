import { ValidationError } from '../../../../shared/domain/errors';
import { fail, ok, Result } from '../../../../shared/domain/result';

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 256;

/**
 * Política de la contraseña nueva (change `add-admin-password-change`, D2): de 12 a 256
 * caracteres contados como puntos de código (un acento o un emoji cuentan 1), distinta de la
 * actual y sin reglas de composición. No recorta ni normaliza espacios: se hashea tal como se
 * escribió.
 */
export function validateNewPassword(
  newPassword: string,
  currentPassword: string,
): Result<void, ValidationError> {
  const length = [...newPassword].length;
  if (length < PASSWORD_MIN) {
    return fail(
      new ValidationError(`La nueva contraseña debe tener al menos ${PASSWORD_MIN} caracteres`, [
        'newPassword',
      ]),
    );
  }
  if (length > PASSWORD_MAX) {
    return fail(
      new ValidationError(`La nueva contraseña debe tener como máximo ${PASSWORD_MAX} caracteres`, [
        'newPassword',
      ]),
    );
  }
  if (newPassword === currentPassword) {
    return fail(
      new ValidationError('La nueva contraseña tiene que ser distinta de la actual', [
        'newPassword',
      ]),
    );
  }
  return ok(undefined);
}
