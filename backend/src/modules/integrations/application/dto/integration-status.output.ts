export interface LastRunOutput {
  readonly outcome: string | null;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly errorClass: string | null;
  readonly errorMessage: string | null;
}

export interface JobCountsOutput {
  readonly pending: number;
  readonly running: number;
  readonly failed: number;
  readonly dead: number;
}

export interface CredentialStatusOutput {
  readonly source: 'env' | 'db' | null;
  readonly keyId: string | null;
  readonly updatedAt: string | null;
}

/** Estado de un proveedor para el panel (D18). Nunca incluye secretos. */
export interface IntegrationStatusOutput {
  readonly provider: string;
  readonly enabled: boolean;
  readonly pausedUntil: string | null;
  readonly pauseReason: string | null;
  readonly stale: boolean;
  readonly lastSuccessAt: string | null;
  readonly lastRun: LastRunOutput | null;
  readonly jobs: JobCountsOutput;
  readonly lastDeadError: string | null;
  readonly credential: CredentialStatusOutput;
}

export interface IntegrationsOverviewOutput {
  readonly schedulerEnabled: boolean;
  readonly providers: IntegrationStatusOutput[];
}

export interface EnqueueSyncOutput {
  readonly jobId: string;
  readonly status: string;
  readonly runAt: string;
  readonly alreadyQueued: boolean;
}
