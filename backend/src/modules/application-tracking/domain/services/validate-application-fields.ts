import { ValidationError } from '../../../../shared/domain/errors';
import { isHttpUrl } from '../../../../shared/domain/http-url';
import { normalizeSource } from '../../../../shared/domain/normalize-source';
import { fail, ok, Result } from '../../../../shared/domain/result';

export const APPLICATION_COMPANY_MAX = 120;
export const APPLICATION_ROLE_MAX = 160;
export const APPLICATION_NOTES_MAX = 5000;
export const APPLICATION_JOB_URL_MAX = 2048;

/** Campos de texto de una postulación, ya recortados y normalizados. */
export interface ApplicationFields {
  readonly company: string;
  readonly role: string;
  readonly jobUrl: string | null;
  readonly portal: string | null;
  readonly notes: string | null;
}

/** Texto sin validar: lo que llega del DTO. `undefined`, `null` y vacío significan «sin valor». */
export interface ApplicationFieldsInput {
  readonly company: string;
  readonly role: string;
  readonly jobUrl?: string | null;
  readonly portal?: string | null;
  readonly notes?: string | null;
}

function blankToNull(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  return value === undefined || value === '' ? null : value;
}

/**
 * Reglas de D2: empresa (1 a 120) y puesto (1 a 160) obligatorios tras recortar; URL absoluta
 * http/https de hasta 2048; portal con la misma norma que los enlaces de seguimiento (inválido
 * es un error, no se descarta); notas de hasta 5000. El DTO es el primer filtro; el dominio manda.
 */
export function validateApplicationFields(
  input: ApplicationFieldsInput,
): Result<ApplicationFields, ValidationError> {
  const company = input.company.trim();
  if (company.length === 0 || company.length > APPLICATION_COMPANY_MAX) {
    return fail(
      new ValidationError(`La empresa debe tener de 1 a ${APPLICATION_COMPANY_MAX} caracteres`, [
        'company',
      ]),
    );
  }
  const role = input.role.trim();
  if (role.length === 0 || role.length > APPLICATION_ROLE_MAX) {
    return fail(
      new ValidationError(`El puesto debe tener de 1 a ${APPLICATION_ROLE_MAX} caracteres`, [
        'role',
      ]),
    );
  }
  const jobUrl = blankToNull(input.jobUrl);
  if (jobUrl !== null && (jobUrl.length > APPLICATION_JOB_URL_MAX || !isHttpUrl(jobUrl))) {
    return fail(
      new ValidationError(
        `La URL de la vacante debe ser absoluta (http o https) y de hasta ${APPLICATION_JOB_URL_MAX} caracteres`,
        ['jobUrl'],
      ),
    );
  }
  const rawPortal = blankToNull(input.portal);
  let portal: string | null = null;
  if (rawPortal !== null) {
    portal = normalizeSource(rawPortal);
    if (portal === null) {
      return fail(
        new ValidationError(
          'El portal admite letras, números y guiones (hasta 32 caracteres) y no puede empezar con guion',
          ['portal'],
        ),
      );
    }
  }
  const notes = blankToNull(input.notes);
  if (notes !== null && notes.length > APPLICATION_NOTES_MAX) {
    return fail(
      new ValidationError(`Las notas admiten hasta ${APPLICATION_NOTES_MAX} caracteres`, ['notes']),
    );
  }
  return ok({ company, role, jobUrl, portal, notes });
}
