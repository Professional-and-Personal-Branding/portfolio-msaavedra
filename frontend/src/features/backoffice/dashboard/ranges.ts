export interface DateRange {
  from: string;
  to: string;
}

export const RANGE_OPTIONS = [
  { value: '7', label: 'Últimos 7 días' },
  { value: '30', label: 'Últimos 30 días' },
  { value: '90', label: 'Últimos 90 días' },
  { value: '365', label: 'Último año' },
] as const;

export const DEFAULT_RANGE_DAYS = '30';

export function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Rango cerrado [hoy - (days - 1), hoy] en fechas ISO (spec `admin-analytics-dashboard`). */
export function rangeOfDays(days: number, today = new Date()): DateRange {
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return { from: toIsoDay(from), to: toIsoDay(today) };
}

/** `2026-09-08` → `8 sep` para las etiquetas del gráfico. */
export function formatDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
    .format(date)
    .replace('.', '');
}
