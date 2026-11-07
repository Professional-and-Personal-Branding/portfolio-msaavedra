import { ValidationError } from '../../../../shared/domain/errors';
import { LocalizedText } from '../../../../shared/domain/i18n';
import { fail, ok, Result } from '../../../../shared/domain/result';
import { NewEducationProps } from '../entities/education.entity';

/**
 * Fecha de formación: YYYY-MM (lo que usa el seed) o YYYY, para títulos de los
 * que solo se recuerda el año.
 */
export const EDUCATION_DATE_REGEX = /^\d{4}(-(0[1-9]|1[0-2]))?$/;

/** true si el texto bilingüe tiene contenido en el idioma origen (`es`). */
export function hasSourceText(value: LocalizedText | string): boolean {
  const text = typeof value === 'string' ? value : value.es;
  return text !== undefined && text.trim().length > 0;
}

/**
 * Compara dos fechas con distinta precisión al nivel de la menor: `2021` y
 * `2021-03` cuentan como el mismo período y no se consideran desordenadas.
 */
export function isAfter(start: string, end: string): boolean {
  const precision = Math.min(start.length, end.length);
  return start.slice(0, precision) > end.slice(0, precision);
}

/**
 * Reglas de dominio de una formación (spec `admin-content-management`):
 * institución y título (`es`) no vacíos, fechas YYYY-MM o YYYY, `inProgress`
 * excluye `endDate`, `startDate <= endDate`.
 */
export function validateEducation(props: NewEducationProps): Result<void, ValidationError> {
  if (props.institution.trim().length === 0) {
    return fail(new ValidationError('institution es obligatorio', ['institution']));
  }
  if (!hasSourceText(props.degree)) {
    return fail(new ValidationError('degree.es es obligatorio', ['degree']));
  }
  if (!EDUCATION_DATE_REGEX.test(props.startDate)) {
    return fail(new ValidationError('startDate debe tener formato YYYY-MM o YYYY', ['startDate']));
  }
  if (props.endDate !== null && !EDUCATION_DATE_REGEX.test(props.endDate)) {
    return fail(new ValidationError('endDate debe tener formato YYYY-MM o YYYY', ['endDate']));
  }
  if (props.inProgress && props.endDate !== null) {
    return fail(
      new ValidationError('Una formación en curso no puede tener endDate', [
        'inProgress',
        'endDate',
      ]),
    );
  }
  if (props.endDate !== null && isAfter(props.startDate, props.endDate)) {
    return fail(
      new ValidationError('startDate no puede ser posterior a endDate', ['startDate', 'endDate']),
    );
  }
  return ok(undefined);
}
