/**
 * Interpretación de los límites del rango de `GET /api/admin/analytics/views`.
 *
 * El contrato es un rango **cerrado**: `to=2026-10-05` incluye todo el 5 de
 * octubre. Una fecha sin hora (`YYYY-MM-DD`) se resuelve al borde del día en UTC
 * — inicio para `from`, final para `to` —, porque `new Date('2026-10-05')` da la
 * medianoche y dejaba fuera el día en curso (defecto D-01 de `docs/MANUAL.md`).
 * Un instante completo (`2026-10-05T14:30:00Z`) se respeta tal cual, para poder
 * consultar ventanas más finas que un día.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Inicio del rango: una fecha sin hora es la medianoche de ese día en UTC. */
export function parseRangeStart(value: string | undefined): Date | undefined {
  return value === undefined ? undefined : new Date(value);
}

/** Final del rango: una fecha sin hora es el último milisegundo de ese día en UTC. */
export function parseRangeEnd(value: string | undefined): Date | undefined {
  if (value === undefined) return undefined;
  return DATE_ONLY.test(value) ? new Date(`${value}T23:59:59.999Z`) : new Date(value);
}
