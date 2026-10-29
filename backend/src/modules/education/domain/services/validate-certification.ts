import { ValidationError } from '../../../../shared/domain/errors';
import { isHttpsUrl } from '../../../../shared/domain/http-url';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { NewCertificationProps } from '../entities/certification.entity';
import { hasSourceText } from './validate-education';

export const YEAR_REGEX = /^\d{4}$/;
/** Vencimiento de una credencial: `YYYY-MM` o `YYYY` (como las fechas de formación). */
export const CERTIFICATION_DATE_REGEX = /^\d{4}(-(0[1-9]|1[0-2]))?$/;
export const VERIFICATION_URL_MAX = 2048;
export const CREDENTIAL_ID_MAX = 100;

/**
 * Reglas de dominio de una certificación (specs `admin-content-management` y
 * `data-persistence-seed`): emisor y nombre (`es`) no vacíos, `year` YYYY o null y, si hay
 * credencial, enlace https de hasta 2048 caracteres, ID no vacío de hasta 100 y vencimiento
 * `YYYY-MM`/`YYYY` que no sea anterior al año de la certificación. El seed reusa esta función
 * (el archivo no pasa por el DTO), así que `javascript:` no entra por ahí.
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
  if (
    props.verificationUrl !== null &&
    (props.verificationUrl.length > VERIFICATION_URL_MAX || !isHttpsUrl(props.verificationUrl))
  ) {
    return fail(
      new ValidationError(
        `verificationUrl debe ser una URL https de hasta ${VERIFICATION_URL_MAX} caracteres`,
        ['verificationUrl'],
      ),
    );
  }
  if (
    props.credentialId !== null &&
    (props.credentialId.trim().length === 0 || props.credentialId.length > CREDENTIAL_ID_MAX)
  ) {
    return fail(
      new ValidationError(`credentialId debe tener entre 1 y ${CREDENTIAL_ID_MAX} caracteres`, [
        'credentialId',
      ]),
    );
  }
  if (props.expiresAt !== null) {
    if (!CERTIFICATION_DATE_REGEX.test(props.expiresAt)) {
      return fail(
        new ValidationError('expiresAt debe tener formato YYYY-MM o YYYY', ['expiresAt']),
      );
    }
    if (props.year !== null && props.expiresAt.slice(0, 4) < props.year) {
      return fail(
        new ValidationError('expiresAt no puede ser anterior al año de la certificación', [
          'expiresAt',
        ]),
      );
    }
  }
  return ok(undefined);
}
