import type {
  IntegrationsOverview,
  IntegrationStatus,
} from '@/features/backoffice/shared/admin-types';

/** Sin proveedores habilitados: lo que devuelve la API con `INTEGRATIONS_ENABLED` vacía. */
export const EMPTY_INTEGRATIONS: IntegrationsOverview = {
  schedulerEnabled: true,
  providers: [],
};

export function makeIntegrationStatus(
  overrides: Partial<IntegrationStatus> = {},
): IntegrationStatus {
  return {
    provider: 'fake',
    enabled: true,
    pausedUntil: null,
    pauseReason: null,
    stale: false,
    lastSuccessAt: '2026-11-12T10:00:00.000Z',
    lastRun: {
      outcome: 'SUCCESS',
      startedAt: '2026-11-12T10:00:00.000Z',
      finishedAt: '2026-11-12T10:00:03.000Z',
      errorClass: null,
      errorMessage: null,
    },
    jobs: { pending: 0, running: 0, failed: 0, dead: 0 },
    lastDeadError: null,
    credential: { source: 'db', keyId: 'k1', updatedAt: '2026-11-10T10:00:00.000Z' },
    ...overrides,
  };
}

export function makeIntegrations(
  providers: IntegrationStatus[] = [makeIntegrationStatus()],
  schedulerEnabled = true,
): IntegrationsOverview {
  return { schedulerEnabled, providers };
}
