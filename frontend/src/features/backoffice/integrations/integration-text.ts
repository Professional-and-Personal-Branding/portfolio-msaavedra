import type { IntegrationStatus, SyncRunOutcome } from '../shared/admin-types';

const pad = (value: number): string => String(value).padStart(2, '0');

/** Instante ISO → `DD/MM/AAAA HH:MM` en la hora local del navegador. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const OUTCOME_LABELS: Readonly<Record<SyncRunOutcome, string>> = {
  SUCCESS: 'Exitosa',
  FAILED: 'Con error (se reintenta)',
  DEAD: 'Fallida (no se reintenta)',
  INTERRUPTED: 'Interrumpida por un reinicio',
  TIMEOUT: 'Tiempo agotado',
};

export const PAUSE_REASONS: Readonly<Record<string, string>> = {
  RetryAfter: 'el proveedor pidió esperar',
  ResetAt: 'límite del proveedor agotado',
  BudgetExhausted: 'presupuesto agotado',
  CircuitOpen: 'varios errores seguidos',
};

/** Estado del proveedor siempre como texto (el color solo lo refuerza). */
export function statusLabel(status: IntegrationStatus): { text: string; tone: string } {
  if (!status.enabled) return { text: 'Pausado', tone: 'text-text-muted' };
  if (status.pausedUntil) {
    return {
      text: `En pausa hasta ${formatDateTime(status.pausedUntil)}`,
      tone: 'text-brand-2-ink',
    };
  }
  return { text: 'Activo', tone: 'text-success-ink' };
}

export const STALE_LABEL = 'Sin sincronizar hace más de 48 h';

export function credentialLabel(credential: IntegrationStatus['credential']): string {
  switch (credential.source) {
    case 'env':
      return 'Variable de entorno del servidor';
    case 'db':
      return credential.keyId
        ? `Guardada en la base (clave ${credential.keyId})`
        : 'Guardada en la base';
    default:
      return 'Sin credencial';
  }
}

/** ¿Hay que avisar en el Dashboard? Una sincronización atrasada o un trabajo muerto. */
export function needsAttention(providers: readonly IntegrationStatus[]): boolean {
  return providers.some((p) => p.stale || p.jobs.dead > 0);
}
