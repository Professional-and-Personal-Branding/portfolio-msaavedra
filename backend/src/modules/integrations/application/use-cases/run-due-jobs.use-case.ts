import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, Clock } from '../../../../shared/domain/clock';
import { redactSecrets } from '../../../../shared/domain/redact-secrets';
import { fail, Result } from '../../../../shared/domain/result';
import { IntegrationJob } from '../../domain/entities/integration-job.entity';
import { permanent, ProviderFailure, transient } from '../../domain/provider-failure';
import {
  INTEGRATION_JOB_REPOSITORY,
  IntegrationJobRepository,
} from '../../domain/repositories/integration-job.repository';
import {
  INTEGRATION_SETTING_REPOSITORY,
  IntegrationSettingRepository,
} from '../../domain/repositories/integration-setting.repository';
import {
  RUNNER_LEASE_REPOSITORY,
  RunnerLeaseRepository,
} from '../../domain/repositories/runner-lease.repository';
import {
  SYNC_RUN_REPOSITORY,
  SyncRunOutcome,
  SyncRunRepository,
} from '../../domain/repositories/sync-run.repository';
import {
  CONNECTOR_REGISTRY,
  ConnectorPort,
  ConnectorRegistry,
  SyncOutcome,
} from '../ports/connector.port';
import { CREDENTIAL_RESOLVER, CredentialResolver } from '../ports/credential-resolver.port';
import {
  INTEGRATIONS_SETTINGS,
  IntegrationsSettings,
  LEASE_GRACE_MS,
  LOCK_GRACE_MS,
  MAX_JOBS_PER_RUN,
  RANDOM_SOURCE,
  RUNNER_HOLDER,
  SHUTDOWN_GRACE_MS,
} from '../ports/integrations-settings.port';
import { RUN_LOGGER_FACTORY, RunLogger, RunLoggerFactory } from '../ports/run-logger.port';
import { SNAPSHOT_STORE, SnapshotStore } from '../ports/snapshot-store.port';
import { YIELD, Yield } from '../ports/yield.port';

export interface RunDueJobsInput {
  /** Señal de apagado del proceso: no se reclaman más trabajos y el actual se interrumpe (D6). */
  readonly shutdown?: AbortSignal;
}

export interface RunSummary {
  /** `false` si otra instancia tiene el arriendo del ejecutor: no se hizo nada. */
  readonly leased: boolean;
  readonly processed: number;
  readonly done: number;
  readonly failed: number;
  readonly dead: number;
  readonly interrupted: number;
}

type Execution =
  | { readonly type: 'ok'; readonly outcome: SyncOutcome }
  | { readonly type: 'failure'; readonly failure: ProviderFailure; readonly timeout: boolean }
  | { readonly type: 'interrupted' };

const RECOVER_BATCH = 100;

/** Resultado de un trabajo para el resumen de la corrida. */
type JobResult = 'DONE' | 'FAILED' | 'DEAD' | 'INTERRUPTED';

/**
 * El corazón de las integraciones (D4–D7): toma el arriendo del ejecutor, recupera locks
 * vencidos y procesa trabajos de a uno, cediendo el turno entre ellos. No conoce Nest ni Prisma:
 * todo llega por puertos. Nunca corre dentro de una petición (D3).
 */
@Injectable()
export class RunDueJobsUseCase {
  constructor(
    @Inject(RUNNER_LEASE_REPOSITORY) private readonly leases: RunnerLeaseRepository,
    @Inject(INTEGRATION_JOB_REPOSITORY) private readonly jobs: IntegrationJobRepository,
    @Inject(INTEGRATION_SETTING_REPOSITORY) private readonly settings: IntegrationSettingRepository,
    @Inject(SYNC_RUN_REPOSITORY) private readonly syncRuns: SyncRunRepository,
    @Inject(CONNECTOR_REGISTRY) private readonly registry: ConnectorRegistry,
    @Inject(CREDENTIAL_RESOLVER) private readonly credentials: CredentialResolver,
    @Inject(SNAPSHOT_STORE) private readonly snapshots: SnapshotStore,
    @Inject(RUN_LOGGER_FACTORY) private readonly loggers: RunLoggerFactory,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(YIELD) private readonly yieldTurn: Yield,
    @Inject(INTEGRATIONS_SETTINGS) private readonly config: IntegrationsSettings,
    @Inject(RUNNER_HOLDER) private readonly holder: string,
    @Inject(RANDOM_SOURCE) private readonly random: () => number,
  ) {}

  async execute(input: RunDueJobsInput = {}): Promise<RunSummary> {
    const summary = { leased: true, processed: 0, done: 0, failed: 0, dead: 0, interrupted: 0 };
    const leaseMs = this.config.runMaxMs + LEASE_GRACE_MS;
    if (!(await this.leases.acquire(this.holder, leaseMs))) {
      this.loggers
        .general()
        .debug('Integraciones: el arriendo del ejecutor lo tiene otra instancia');
      return { ...summary, leased: false };
    }
    try {
      await this.recoverExpiredLocks();
      const startedMs = this.clock.now().getTime();
      while (summary.processed < MAX_JOBS_PER_RUN) {
        if (input.shutdown?.aborted) break;
        if (this.clock.now().getTime() - startedMs >= this.config.runMaxMs) break;
        // Renueva el arriendo antes de cada reclamo; si no se puede, la corrida termina.
        if (!(await this.leases.acquire(this.holder, leaseMs))) break;
        const providers = await this.claimableProviders();
        if (providers.length === 0) break;
        const job = await this.jobs.claimNext(
          providers,
          this.config.jobTimeoutMs + LOCK_GRACE_MS,
          this.holder,
        );
        if (!job) break;
        // Entre dos trabajos se cede el turno al event loop (D5).
        if (summary.processed > 0) await this.yieldTurn();
        const result = await this.processJob(job, input.shutdown);
        summary.processed += 1;
        if (result === 'DONE') summary.done += 1;
        else if (result === 'DEAD') summary.dead += 1;
        else if (result === 'INTERRUPTED') summary.interrupted += 1;
        else summary.failed += 1;
      }
    } finally {
      await this.leases.release(this.holder);
    }
    return summary;
  }

  private async recoverExpiredLocks(): Promise<void> {
    const now = this.clock.now();
    for (const job of await this.jobs.listExpiredLocks(RECOVER_BATCH)) {
      const recovered = job.expireLock(now, this.random);
      if (recovered.ok && !(await this.jobs.save(recovered.value, job.props.lockedBy))) {
        this.loggers
          .general()
          .warn('Trabajo con el lock vencido ya recuperado por otra instancia', { jobId: job.id });
      }
    }
  }

  private async claimableProviders(): Promise<string[]> {
    const now = this.clock.now();
    const enabled = this.config.enabledProviders;
    if (enabled.length === 0) return [];
    const settings = await this.settings.getOrCreateMany(enabled, now);
    return enabled.filter((provider) => settings.get(provider)?.isClaimable(now) === true);
  }

  private async processJob(
    job: IntegrationJob,
    shutdown: AbortSignal | undefined,
  ): Promise<JobResult> {
    const startedAt = this.clock.now();
    const syncRunId = await this.syncRuns.start(job.id, job.provider, startedAt);
    // El secreto se resuelve antes de crear el logger para que este lo redacte de todo lo que escriba (B4).
    const connector = this.registry.get(job.provider);
    const credential = connector ? await this.credentials.resolve(job.provider) : undefined;
    const secret = credential?.ok ? credential.value.secret : '';
    const log = this.loggers.forRun({
      syncRunId,
      jobId: job.id,
      provider: job.provider,
      secrets: secret === '' ? [] : [secret],
    });
    log.info('Trabajo iniciado', { attempt: job.attempts });

    let execution: Execution;
    if (!connector) {
      execution = {
        type: 'failure',
        failure: permanent('proveedor no habilitado'),
        timeout: false,
      };
    } else if (credential && !credential.ok) {
      execution = {
        type: 'failure',
        failure: permanent(credential.error.message),
        timeout: false,
      };
    } else {
      execution = await this.runConnector(connector, job, secret, log, shutdown);
    }
    return this.settle(job, syncRunId, startedAt, execution, secret, log);
  }

  /** Corre el conector con timeout, señal de aborto y espera acotada al apagar (D5, D6). */
  private async runConnector(
    connector: ConnectorPort,
    job: IntegrationJob,
    secret: string,
    log: RunLogger,
    shutdown: AbortSignal | undefined,
  ): Promise<Execution> {
    const controller = new AbortController();
    const timers: NodeJS.Timeout[] = [];
    let armGrace: (() => void) | undefined;
    // Un único handler con nombre (M3): se quita en el `finally` y la señal compartida del proceso no
    // acumula un listener —ni lo que su cierre retiene, como el secreto— por cada trabajo.
    const onShutdown = (): void => {
      controller.abort();
      armGrace?.();
    };

    const connectorPromise: Promise<Result<SyncOutcome, ProviderFailure>> = (async () => {
      try {
        return await connector.sync(
          {
            jobId: job.id,
            provider: job.provider,
            payload: job.props.payload,
            secret,
            snapshots: this.snapshots,
            log,
          },
          controller.signal,
        );
      } catch (error) {
        return fail(transient(error instanceof Error ? error.message : String(error)));
      }
    })();

    const timeout = new Promise<'timeout'>((resolve) => {
      timers.push(setTimeout(() => resolve('timeout'), this.config.jobTimeoutMs));
    });
    const interrupted = new Promise<'interrupted'>((resolve) => {
      armGrace = () => timers.push(setTimeout(() => resolve('interrupted'), SHUTDOWN_GRACE_MS));
    });
    if (shutdown) {
      if (shutdown.aborted) onShutdown();
      else shutdown.addEventListener('abort', onShutdown, { once: true });
    }

    try {
      const winner = await Promise.race([
        connectorPromise.then((result) => ({ type: 'result' as const, result })),
        timeout.then(() => ({ type: 'timeout' as const })),
        interrupted.then(() => ({ type: 'interrupted' as const })),
      ]);
      if (winner.type === 'timeout') {
        controller.abort();
        return {
          type: 'failure',
          failure: transient(`timeout a los ${this.config.jobTimeoutMs} ms`),
          timeout: true,
        };
      }
      if (winner.type === 'interrupted') return { type: 'interrupted' };
      if (winner.result.ok) return { type: 'ok', outcome: winner.result.value };
      // Un conector que falla porque lo abortamos por el apagado no es un fallo del proveedor.
      if (shutdown?.aborted) return { type: 'interrupted' };
      return { type: 'failure', failure: winner.result.error, timeout: false };
    } finally {
      for (const timer of timers) clearTimeout(timer);
      shutdown?.removeEventListener('abort', onShutdown);
    }
  }

  /** B1: el arriendo se perdió y otro proceso se hizo cargo del trabajo: se loguea y se descarta el resultado. */
  private async discard(
    job: IntegrationJob,
    syncRunId: string,
    now: Date,
    durationMs: number,
    log: RunLogger,
  ): Promise<JobResult> {
    log.warn('Se perdió el arriendo del trabajo: resultado descartado', { jobId: job.id });
    await this.syncRuns.finish(syncRunId, {
      outcome: 'INTERRUPTED',
      errorMessage: 'arriendo perdido: resultado descartado',
      finishedAt: now,
      durationMs,
    });
    return 'INTERRUPTED';
  }

  /** Persiste el resultado: trabajo, estado del proveedor y `SyncRun`. */
  private async settle(
    job: IntegrationJob,
    syncRunId: string,
    startedAt: Date,
    execution: Execution,
    secret: string,
    log: RunLogger,
  ): Promise<JobResult> {
    const now = this.clock.now();
    const durationMs = Math.max(0, now.getTime() - startedAt.getTime());
    const secrets = secret === '' ? [] : [secret];
    const setting = await this.settings.getOrCreate(job.provider, now);

    if (execution.type === 'ok') {
      if (!(await this.jobs.save(unwrap(job.complete(now)), this.holder))) {
        return this.discard(job, syncRunId, now, durationMs, log);
      }
      await this.settings.saveHealth(setting.recordSuccess(now));
      await this.syncRuns.finish(syncRunId, {
        outcome: 'SUCCESS',
        itemsChanged: execution.outcome.itemsChanged,
        finishedAt: now,
        durationMs,
      });
      log.info('Trabajo terminado', { itemsChanged: execution.outcome.itemsChanged, durationMs });
      return 'DONE';
    }

    if (execution.type === 'interrupted') {
      if (!(await this.jobs.save(unwrap(job.release(now)), this.holder))) {
        return this.discard(job, syncRunId, now, durationMs, log);
      }
      await this.syncRuns.finish(syncRunId, {
        outcome: 'INTERRUPTED',
        finishedAt: now,
        durationMs,
      });
      log.warn('Trabajo interrumpido por el apagado: vuelve a la cola');
      return 'INTERRUPTED';
    }

    const failure = {
      ...execution.failure,
      message: redactSecrets(execution.failure.message, secrets),
    };
    const failed = unwrap(job.fail(failure, now, this.random));
    if (!(await this.jobs.save(failed, this.holder))) {
      return this.discard(job, syncRunId, now, durationMs, log);
    }
    await this.settings.saveHealth(setting.recordFailure(failure, now, this.random));
    const outcome: SyncRunOutcome = execution.timeout
      ? 'TIMEOUT'
      : failed.status === 'DEAD'
        ? 'DEAD'
        : 'FAILED';
    await this.syncRuns.finish(syncRunId, {
      outcome,
      errorClass: failure.kind,
      errorMessage: failure.message,
      finishedAt: now,
      durationMs,
    });
    log.warn('Trabajo con error', {
      errorClass: failure.kind,
      error: failure.message,
      status: failed.status,
    });
    return failed.status === 'DEAD' ? 'DEAD' : 'FAILED';
  }
}

function unwrap<T>(result: Result<T, Error>): T {
  if (!result.ok) throw result.error;
  return result.value;
}
