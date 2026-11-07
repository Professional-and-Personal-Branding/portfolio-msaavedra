import { ValidationError } from '../../../../shared/domain/errors';
import { fail, ok, Result } from '../../../../shared/domain/result';

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Fecha UTC del reloj como `AAAA-MM-DD`. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** `true` si es una fecha de calendario real con la forma `AAAA-MM-DD`. */
export function isCalendarDay(value: string): boolean {
  const match = DAY_PATTERN.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

/**
 * Fecha de postulación explícita: calendario real y no posterior al día UTC del reloj más uno
 * (la tolerancia evita rechazar «hoy» en Argentina pasadas las 21:00; D4).
 */
export function validateAppliedAt(raw: string, now: Date): Result<string, ValidationError> {
  if (!isCalendarDay(raw)) {
    return fail(
      new ValidationError('La fecha de postulación debe tener el formato AAAA-MM-DD', [
        'appliedAt',
      ]),
    );
  }
  const limit = utcDay(new Date(now.getTime() + DAY_MS));
  if (raw > limit) {
    return fail(new ValidationError('La fecha de postulación no puede ser futura', ['appliedAt']));
  }
  return ok(raw);
}
