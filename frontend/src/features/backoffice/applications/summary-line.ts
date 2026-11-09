import { formatCount } from '@/shared/i18n/plural';
import type { ApplicationStatus, ApplicationSummary } from '../shared/admin-types';
import { ACTIVE_STATUSES } from './application-status';

/** Fragmento de la línea por estado activo (D12): solo los estados con más de cero. */
const SEGMENTS: Readonly<Record<ApplicationStatus, (count: number) => string>> = {
  DRAFT: (count) => `${count} por postular`,
  APPLIED: (count) => formatCount(count, { one: 'postulada', other: 'postuladas' }),
  INTERVIEWING: (count) => `${count} en entrevistas`,
  OFFER: (count) => `${count} con oferta`,
  ACCEPTED: (count) => `${count} aceptadas`,
  REJECTED: (count) => `${count} rechazadas`,
  WITHDRAWN: (count) => `${count} retiradas`,
};

/**
 * «Postulaciones activas: 5 · 1 por postular · 2 postuladas · 1 en entrevistas · 1 con oferta»;
 * con cero activas, «Sin postulaciones activas». Los estados en cero se omiten.
 */
export function summaryLine(summary: ApplicationSummary): string {
  if (summary.active === 0) return 'Sin postulaciones activas';
  const parts = ACTIVE_STATUSES.flatMap((status) => {
    const count = summary.byStatus[status] ?? 0;
    return count > 0 ? [SEGMENTS[status](count)] : [];
  });
  return [`Postulaciones activas: ${summary.active}`, ...parts].join(' · ');
}
