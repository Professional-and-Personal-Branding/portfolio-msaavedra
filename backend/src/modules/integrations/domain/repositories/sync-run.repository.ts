export const SYNC_RUN_REPOSITORY = Symbol('SYNC_RUN_REPOSITORY');

export type SyncRunOutcome = 'SUCCESS' | 'FAILED' | 'DEAD' | 'INTERRUPTED' | 'TIMEOUT';

export interface SyncRunRecord {
  readonly id: string;
  readonly jobId: string;
  readonly provider: string;
  readonly startedAt: Date;
  readonly finishedAt: Date | null;
  readonly outcome: SyncRunOutcome | null;
  readonly errorClass: string | null;
  readonly errorMessage: string | null;
  readonly itemsChanged: number;
  readonly durationMs: number | null;
}

export interface FinishSyncRunInput {
  readonly outcome: SyncRunOutcome;
  readonly errorClass?: string | null;
  readonly errorMessage?: string | null;
  readonly itemsChanged?: number;
  readonly finishedAt: Date;
  readonly durationMs: number;
}

export interface SyncRunRepository {
  /** Abre un intento y devuelve su id (el `syncRunId` del log). */
  start(jobId: string, provider: string, startedAt: Date): Promise<string>;
  finish(id: string, input: FinishSyncRunInput): Promise<void>;
  /** La corrida más reciente de cada proveedor. */
  latestByProvider(providers: readonly string[]): Promise<ReadonlyMap<string, SyncRunRecord>>;
}
