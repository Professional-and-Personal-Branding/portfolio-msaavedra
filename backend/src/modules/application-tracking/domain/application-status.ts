/** Estados de una postulación (decisión D4 de `add-application-tracking`). */
export const APPLICATION_STATUSES = [
  'DRAFT',
  'APPLIED',
  'INTERVIEWING',
  'OFFER',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/**
 * Máquina de estados: desde cada estado, a cuáles se puede pasar. `ACCEPTED` es final;
 * `REJECTED` y `WITHDRAWN` se pueden reabrir hacia `APPLIED`. Pasar al mismo estado no figura
 * aquí: es un no-op que resuelve la entidad.
 */
export const APPLICATION_TRANSITIONS: Readonly<
  Record<ApplicationStatus, readonly ApplicationStatus[]>
> = {
  DRAFT: ['APPLIED', 'WITHDRAWN'],
  APPLIED: ['INTERVIEWING', 'OFFER', 'REJECTED', 'WITHDRAWN'],
  INTERVIEWING: ['OFFER', 'REJECTED', 'WITHDRAWN'],
  OFFER: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  ACCEPTED: [],
  REJECTED: ['APPLIED'],
  WITHDRAWN: ['APPLIED'],
};

/** Procesos en curso: lo que cuenta `active` en el resumen. Las otras tres son cerradas. */
export const ACTIVE_APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  'DRAFT',
  'APPLIED',
  'INTERVIEWING',
  'OFFER',
];

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === 'string' && (APPLICATION_STATUSES as readonly string[]).includes(value);
}
