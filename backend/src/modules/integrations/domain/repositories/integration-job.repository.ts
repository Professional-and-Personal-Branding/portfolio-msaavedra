import { IntegrationJob, IntegrationJobStatus } from '../entities/integration-job.entity';

export const INTEGRATION_JOB_REPOSITORY = Symbol('INTEGRATION_JOB_REPOSITORY');

export interface EnqueueJobInput {
  readonly provider: string;
  readonly kind: string;
  readonly idempotencyKey: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly runAt: Date;
  readonly maxAttempts?: number;
}

export interface EnqueueJobResult {
  readonly job: IntegrationJob;
  /** `false` si ya existía un trabajo con esa clave (no se insertó nada). */
  readonly created: boolean;
}

export interface JobCounts {
  readonly pending: number;
  readonly running: number;
  readonly failed: number;
  readonly dead: number;
}

export interface JobSummary {
  readonly counts: JobCounts;
  readonly lastDeadError: string | null;
}

export interface PurgeResult {
  readonly jobs: number;
  readonly runs: number;
}

export interface IntegrationJobRepository {
  /** `INSERT … ON CONFLICT ("idempotencyKey") DO NOTHING`; devuelve el existente si chocó. */
  enqueue(input: EnqueueJobInput): Promise<EnqueueJobResult>;
  /** Un trabajo `PENDING`, `RUNNING` o `FAILED` del proveedor (el más antiguo), si hay. */
  findActiveByProvider(provider: string): Promise<IntegrationJob | null>;
  /** Reclama el próximo trabajo vencido con `FOR UPDATE SKIP LOCKED` (D4). */
  claimNext(
    providers: readonly string[],
    lockMs: number,
    holder: string,
  ): Promise<IntegrationJob | null>;
  /** Trabajos `RUNNING` con el lock vencido (para pasarlos por `expireLock`). */
  listExpiredLocks(limit: number): Promise<IntegrationJob[]>;
  /**
   * Guarda el trabajo solo si sigue `RUNNING` y con el mismo `lockedBy` (B1): si el arriendo se perdió y
   * otro proceso lo recuperó o lo reclamó, no se pisa su estado. Devuelve `false` si no escribió nada.
   */
  save(job: IntegrationJob, expectedLockedBy: string | null): Promise<boolean>;
  /** Un solo `groupBy` por estado más el último error de un trabajo `DEAD` por proveedor. */
  summarize(providers: readonly string[]): Promise<ReadonlyMap<string, JobSummary>>;
  /** Retención (D23): `DONE` anteriores a `doneOlderThanDays` y `DEAD`/`SyncRun` a `deadOlderThanDays`. */
  purge(now: Date, doneOlderThanDays: number, deadOlderThanDays: number): Promise<PurgeResult>;
}

export type { IntegrationJobStatus };
