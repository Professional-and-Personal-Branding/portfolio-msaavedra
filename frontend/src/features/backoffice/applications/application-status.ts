import type { ApplicationStatus } from '../shared/admin-types';

/** Los siete estados en el orden del camino principal y sus salidas (D4 de `add-application-tracking`). */
export const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  'DRAFT',
  'APPLIED',
  'INTERVIEWING',
  'OFFER',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
];

/** Etiquetas del panel; son las mismas del CSV (`to-application-csv.ts` del backend). */
export const STATUS_LABELS: Readonly<Record<ApplicationStatus, string>> = {
  DRAFT: 'Por postular',
  APPLIED: 'Postulada',
  INTERVIEWING: 'En entrevistas',
  OFFER: 'Oferta',
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
  WITHDRAWN: 'Retirada',
};

/** Procesos en curso; el resto son cerradas. Lo mismo que cuenta `active` del resumen. */
export const ACTIVE_STATUSES: readonly ApplicationStatus[] = [
  'DRAFT',
  'APPLIED',
  'INTERVIEWING',
  'OFFER',
];

/** Color del texto de la insignia: el significado siempre va también en el texto. */
export const STATUS_TONE: Readonly<Record<ApplicationStatus, string>> = {
  DRAFT: 'text-text-muted',
  APPLIED: 'text-brand-ink',
  INTERVIEWING: 'text-brand-2-ink',
  OFFER: 'text-success-ink',
  ACCEPTED: 'text-success-ink',
  REJECTED: 'text-danger-ink',
  WITHDRAWN: 'text-text-muted',
};

/** Filtro de la lista; vive en la URL como `?estado=` (D11). */
export type StatusFilter = 'activas' | 'todas' | Lowercase<ApplicationStatus>;

export const DEFAULT_FILTER: StatusFilter = 'activas';

export const FILTER_OPTIONS: readonly { value: StatusFilter; label: string }[] = [
  { value: 'activas', label: 'Activas' },
  { value: 'todas', label: 'Todas' },
  ...APPLICATION_STATUSES.map((status) => ({
    value: status.toLowerCase() as Lowercase<ApplicationStatus>,
    label: STATUS_LABELS[status],
  })),
];

/** Valor de `?estado=` → filtro; lo desconocido o ausente vuelve a `Activas`. */
export function parseFilter(raw: string | null): StatusFilter {
  return FILTER_OPTIONS.find((option) => option.value === raw)?.value ?? DEFAULT_FILTER;
}

/** Estados a pedir al servidor; `undefined` es «todas» (sin parámetro `status`). */
export function filterStatuses(filter: StatusFilter): ApplicationStatus[] | undefined {
  if (filter === 'todas') return undefined;
  if (filter === 'activas') return [...ACTIVE_STATUSES];
  return APPLICATION_STATUSES.filter((status) => status.toLowerCase() === filter);
}

/** Valor del parámetro `status` de la API (estados separados por coma). */
export function statusQuery(
  statuses: readonly ApplicationStatus[] | undefined,
): string | undefined {
  return statuses && statuses.length > 0 ? statuses.join(',') : undefined;
}

/** `AAAA-MM-DD` → `DD/MM/AAAA`, sin pasar por `Date` (no depende de la zona horaria). */
export function formatDay(day: string): string {
  const [year, month, date] = day.split('-');
  return year && month && date ? `${date}/${month}/${year}` : day;
}

/** Instante ISO → `DD/MM/AAAA` en la fecha local del navegador. */
export function formatInstant(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** Fecha local de hoy como `AAAA-MM-DD`. */
export function localToday(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
