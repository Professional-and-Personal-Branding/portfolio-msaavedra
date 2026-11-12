/**
 * Dobles en memoria de los puertos de `integrations` para los tests unitarios de los casos de
 * uso (repositorios mockeados, reloj fijo). Ninguno toca Prisma ni la red.
 */
import { Clock } from '../../src/shared/domain/clock';
import { Result } from '../../src/shared/domain/result';
import {
  CONNECTOR_REGISTRY,
  ConnectorPort,
  ConnectorRegistry,
  SyncContext,
  SyncOutcome,
} from '../../src/modules/integrations/application/ports/connector.port';
import {
  RunLogContext,
  RunLogger,
  RunLoggerFactory,
} from '../../src/modules/integrations/application/ports/run-logger.port';
import {
  CredentialDescription,
  CredentialResolver,
  ResolvedCredential,
} from '../../src/modules/integrations/application/ports/credential-resolver.port';
import {
  IntegrationJob,
  IntegrationJobProps,
} from '../../src/modules/integrations/domain/entities/integration-job.entity';
import { IntegrationSetting } from '../../src/modules/integrations/domain/entities/integration-setting.entity';
import {
  CredentialMissingError,
  CredentialUnreadableError,
} from '../../src/modules/integrations/domain/errors/integration.errors';
import { ProviderFailure } from '../../src/modules/integrations/domain/provider-failure';
import {
  EnqueueJobInput,
  EnqueueJobResult,
  IntegrationJobRepository,
  JobSummary,
  PurgeResult,
} from '../../src/modules/integrations/domain/repositories/integration-job.repository';
import { IntegrationSettingRepository } from '../../src/modules/integrations/domain/repositories/integration-setting.repository';
import { RunnerLeaseRepository } from '../../src/modules/integrations/domain/repositories/runner-lease.repository';
import {
  FinishSyncRunInput,
  SyncRunRecord,
  SyncRunRepository,
} from '../../src/modules/integrations/domain/repositories/sync-run.repository';

export { CONNECTOR_REGISTRY };

export class FakeClock implements Clock {
  constructor(private current: Date = new Date('2026-11-12T12:00:00.000Z')) {}
  now(): Date {
    return new Date(this.current.getTime());
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export function makeJob(patch: Partial<IntegrationJobProps> = {}): IntegrationJob {
  const now = new Date('2026-11-12T12:00:00.000Z');
  return new IntegrationJob({
    id: 'job-1',
    provider: 'fake',
    kind: 'sync',
    idempotencyKey: 'k1',
    payload: {},
    status: 'PENDING',
    attempts: 0,
    maxAttempts: 8,
    runAt: now,
    lockedBy: null,
    lockedUntil: null,
    lastErrorClass: null,
    lastError: null,
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
    ...patch,
  });
}

export class InMemoryJobRepository implements IntegrationJobRepository {
  readonly jobs = new Map<string, IntegrationJob>();
  readonly purgeCalls: Array<{ done: number; dead: number }> = [];
  enqueueCalls = 0;
  private seq = 0;

  constructor(private readonly clock: Clock) {}

  add(job: IntegrationJob): IntegrationJob {
    this.jobs.set(job.id, job);
    return job;
  }

  async enqueue(input: EnqueueJobInput): Promise<EnqueueJobResult> {
    this.enqueueCalls += 1;
    const existing = [...this.jobs.values()].find(
      (j) => j.props.idempotencyKey === input.idempotencyKey,
    );
    if (existing) return { job: existing, created: false };
    const now = this.clock.now();
    this.seq += 1;
    const job = makeJob({
      id: `job-${this.seq}`,
      provider: input.provider,
      kind: input.kind,
      idempotencyKey: input.idempotencyKey,
      payload: input.payload,
      runAt: input.runAt,
      maxAttempts: input.maxAttempts ?? 8,
      createdAt: now,
      updatedAt: now,
    });
    this.jobs.set(job.id, job);
    return { job, created: true };
  }

  async findActiveByProvider(provider: string): Promise<IntegrationJob | null> {
    return (
      [...this.jobs.values()].find(
        (j) => j.provider === provider && ['PENDING', 'RUNNING', 'FAILED'].includes(j.status),
      ) ?? null
    );
  }

  async claimNext(
    providers: readonly string[],
    lockMs: number,
    holder: string,
  ): Promise<IntegrationJob | null> {
    const now = this.clock.now();
    const next = [...this.jobs.values()]
      .filter(
        (j) =>
          ['PENDING', 'FAILED'].includes(j.status) &&
          j.props.runAt.getTime() <= now.getTime() &&
          providers.includes(j.provider),
      )
      .sort(
        (a, b) =>
          a.props.runAt.getTime() - b.props.runAt.getTime() ||
          a.props.createdAt.getTime() - b.props.createdAt.getTime(),
      )[0];
    if (!next) return null;
    const claimed = next.claim(holder, now, lockMs);
    if (!claimed.ok) throw claimed.error;
    this.jobs.set(claimed.value.id, claimed.value);
    return claimed.value;
  }

  async listExpiredLocks(limit: number): Promise<IntegrationJob[]> {
    const now = this.clock.now().getTime();
    return [...this.jobs.values()]
      .filter(
        (j) =>
          j.status === 'RUNNING' &&
          j.props.lockedUntil !== null &&
          j.props.lockedUntil.getTime() < now,
      )
      .slice(0, limit);
  }

  async save(job: IntegrationJob): Promise<void> {
    this.jobs.set(job.id, job);
  }

  async summarize(providers: readonly string[]): Promise<ReadonlyMap<string, JobSummary>> {
    const out = new Map<string, JobSummary>();
    for (const provider of providers) {
      const mine = [...this.jobs.values()].filter((j) => j.provider === provider);
      const count = (s: string): number => mine.filter((j) => j.status === s).length;
      const dead = mine.filter((j) => j.status === 'DEAD');
      out.set(provider, {
        counts: {
          pending: count('PENDING'),
          running: count('RUNNING'),
          failed: count('FAILED'),
          dead: dead.length,
        },
        lastDeadError: dead.length > 0 ? (dead[dead.length - 1].props.lastError ?? null) : null,
      });
    }
    return out;
  }

  async purge(_now: Date, done: number, dead: number): Promise<PurgeResult> {
    this.purgeCalls.push({ done, dead });
    return { jobs: 0, runs: 0 };
  }
}

export class InMemorySettingRepository implements IntegrationSettingRepository {
  readonly rows = new Map<string, IntegrationSetting>();
  constructor(private readonly clock: Clock) {}

  async getOrCreate(provider: string, now: Date): Promise<IntegrationSetting> {
    let row = this.rows.get(provider);
    if (!row) {
      row = IntegrationSetting.initial(provider, now);
      this.rows.set(provider, row);
    }
    return row;
  }

  async getOrCreateMany(
    providers: readonly string[],
    now: Date,
  ): Promise<ReadonlyMap<string, IntegrationSetting>> {
    const out = new Map<string, IntegrationSetting>();
    for (const p of providers) out.set(p, await this.getOrCreate(p, now));
    return out;
  }

  async saveHealth(setting: IntegrationSetting): Promise<void> {
    const current = this.rows.get(setting.provider);
    this.rows.set(
      setting.provider,
      current ? new IntegrationSetting({ ...setting.props, enabled: current.enabled }) : setting,
    );
  }

  async saveEnabled(setting: IntegrationSetting): Promise<void> {
    this.rows.set(setting.provider, setting);
  }

  clockNow(): Date {
    return this.clock.now();
  }
}

export class InMemorySyncRunRepository implements SyncRunRepository {
  readonly runs: SyncRunRecord[] = [];
  private seq = 0;

  async start(jobId: string, provider: string, startedAt: Date): Promise<string> {
    this.seq += 1;
    const id = `run-${this.seq}`;
    this.runs.push({
      id,
      jobId,
      provider,
      startedAt,
      finishedAt: null,
      outcome: null,
      errorClass: null,
      errorMessage: null,
      itemsChanged: 0,
      durationMs: null,
    });
    return id;
  }

  async finish(id: string, input: FinishSyncRunInput): Promise<void> {
    const index = this.runs.findIndex((r) => r.id === id);
    this.runs[index] = {
      ...this.runs[index],
      finishedAt: input.finishedAt,
      outcome: input.outcome,
      errorClass: input.errorClass ?? null,
      errorMessage: input.errorMessage ?? null,
      itemsChanged: input.itemsChanged ?? 0,
      durationMs: input.durationMs,
    };
  }

  async latestByProvider(
    providers: readonly string[],
  ): Promise<ReadonlyMap<string, SyncRunRecord>> {
    const out = new Map<string, SyncRunRecord>();
    for (const p of providers) {
      const mine = this.runs.filter((r) => r.provider === p);
      if (mine.length > 0) out.set(p, mine[mine.length - 1]);
    }
    return out;
  }
}

export class InMemoryLease implements RunnerLeaseRepository {
  holder: string | null = null;
  acquireCalls = 0;
  /** Si es mayor que 0, `acquire` falla tras esa cantidad de éxitos (arriendo perdido a mitad). */
  failAfter: number | null = null;
  refuse = false;

  async acquire(holder: string): Promise<boolean> {
    this.acquireCalls += 1;
    if (this.refuse) return false;
    if (this.failAfter !== null && this.acquireCalls > this.failAfter) return false;
    this.holder = holder;
    return true;
  }

  async release(holder: string): Promise<void> {
    if (this.holder === holder) this.holder = null;
  }
}

export class CapturingLogger implements RunLogger {
  readonly lines: Array<{ level: string; message: string; data?: Record<string, unknown> }> = [];
  debug(message: string, data?: Record<string, unknown>): void {
    this.lines.push({ level: 'debug', message, data });
  }
  info(message: string, data?: Record<string, unknown>): void {
    this.lines.push({ level: 'info', message, data });
  }
  warn(message: string, data?: Record<string, unknown>): void {
    this.lines.push({ level: 'warn', message, data });
  }
  error(message: string, data?: Record<string, unknown>): void {
    this.lines.push({ level: 'error', message, data });
  }
}

export class CapturingLoggerFactory implements RunLoggerFactory {
  readonly logger = new CapturingLogger();
  readonly contexts: RunLogContext[] = [];
  forRun(context: RunLogContext): RunLogger {
    this.contexts.push(context);
    return this.logger;
  }
  general(): RunLogger {
    return this.logger;
  }
}

export class FakeCredentialResolver implements CredentialResolver {
  result: Result<ResolvedCredential, CredentialMissingError | CredentialUnreadableError> = {
    ok: true,
    value: { secret: 'secreto-de-prueba-123', source: 'env' },
  };
  description: CredentialDescription = { source: 'env', keyId: null, updatedAt: null };
  async resolve(): Promise<
    Result<ResolvedCredential, CredentialMissingError | CredentialUnreadableError>
  > {
    return this.result;
  }
  async describe(): Promise<CredentialDescription> {
    return this.description;
  }
}

export class ScriptedConnector implements ConnectorPort {
  readonly requiredEnv: readonly string[] = [];
  calls = 0;
  constructor(
    readonly id: string,
    public handler: (
      ctx: SyncContext,
      signal: AbortSignal,
    ) => Promise<Result<SyncOutcome, ProviderFailure>>,
  ) {}
  async sync(ctx: SyncContext, signal: AbortSignal): Promise<Result<SyncOutcome, ProviderFailure>> {
    this.calls += 1;
    return this.handler(ctx, signal);
  }
}

export class StaticRegistry implements ConnectorRegistry {
  constructor(private readonly connectors: ConnectorPort[]) {}
  get(provider: string): ConnectorPort | undefined {
    return this.connectors.find((c) => c.id === provider);
  }
  ids(): readonly string[] {
    return this.connectors.map((c) => c.id);
  }
}
