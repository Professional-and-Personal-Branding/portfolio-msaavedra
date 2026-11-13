/**
 * Utilidades de los e2e de `integrations`: app con `INTEGRATIONS_ENABLED=fake`, claves y token
 * generados al azar en cada corrida (jamás hay un secreto real ni fijo), ejecutores extra con
 * otro `holder` y limpieza de lo que crean los tests.
 */
import { randomBytes } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { Prisma, PrismaClient } from '@prisma/client';
import { Writable } from 'stream';
import pino from 'pino';
import { GLOBAL_PREFIX, PREFIX_EXCLUDED_ROUTES } from '../src/app.constants';
import { AppModule } from '../src/app.module';
import { CONNECTOR_REGISTRY } from '../src/modules/integrations/application/ports/connector.port';
import { CREDENTIAL_RESOLVER } from '../src/modules/integrations/application/ports/credential-resolver.port';
import { INTEGRATIONS_SETTINGS } from '../src/modules/integrations/application/ports/integrations-settings.port';
import { RUN_LOGGER_FACTORY } from '../src/modules/integrations/application/ports/run-logger.port';
import { SNAPSHOT_STORE } from '../src/modules/integrations/application/ports/snapshot-store.port';
import { YIELD } from '../src/modules/integrations/application/ports/yield.port';
import { RunDueJobsUseCase } from '../src/modules/integrations/application/use-cases/run-due-jobs.use-case';
import { CLOCK } from '../src/shared/domain/clock';
import { INTEGRATION_JOB_REPOSITORY } from '../src/modules/integrations/domain/repositories/integration-job.repository';
import { INTEGRATION_SETTING_REPOSITORY } from '../src/modules/integrations/domain/repositories/integration-setting.repository';
import { RUNNER_LEASE_REPOSITORY } from '../src/modules/integrations/domain/repositories/runner-lease.repository';
import { SYNC_RUN_REPOSITORY } from '../src/modules/integrations/domain/repositories/sync-run.repository';
import { FakeConnector } from '../src/modules/integrations/infrastructure/providers/fake/fake.connector';
import { INTEGRATIONS_BASE_LOGGER } from '../src/modules/integrations/infrastructure/logging/pino-run-logger.factory';
import { buildLoggerOptions } from '../src/shared/infrastructure/http/logger.options';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';
import { RANDOM_SOURCE } from '../src/modules/integrations/application/ports/integrations-settings.port';
import { buildCorsOptions } from '../src/shared/infrastructure/http/cors.options';
import { requestIdMiddleware } from '../src/shared/infrastructure/http/request-id';
import { FRONTEND_URL } from './e2e-helpers';

export interface IntegrationsEnvOptions {
  schedulerEnabled?: boolean;
  /** `false` arranca sin `FAKE_PROVIDER_TOKEN`: la credencial sale de la base (default `true`). */
  secretFromEnv?: boolean;
  tickSeconds?: number;
  /** Variables extra (p. ej. `INTEGRATIONS_JOB_TIMEOUT_MS`). */
  extra?: Record<string, string>;
}

const MANAGED = [
  'INTEGRATIONS_ENABLED',
  'FAKE_PROVIDER_TOKEN',
  'INTEGRATIONS_KEYS',
  'INTEGRATIONS_ACTIVE_KEY',
  'INTEGRATIONS_SCHEDULER_ENABLED',
  'INTEGRATIONS_TICK_SECONDS',
  'INTEGRATIONS_JOB_TIMEOUT_MS',
  'INTEGRATIONS_RUN_MAX_MS',
  'INTEGRATIONS_SYNC_CRON',
];

/** Token de prueba de esta corrida: se genera al azar y nunca se imprime. */
export const TEST_FAKE_TOKEN = `tok_${randomBytes(18).toString('hex')}`;

export interface IntegrationsTestApp {
  app: INestApplication;
  prisma: PrismaService;
  fake: FakeConnector;
  /** Líneas de log que escribió el trabajo, ya con la redacción real de la app. */
  logLines: () => string[];
  restoreEnv: () => void;
  close: () => Promise<void>;
}

export function applyIntegrationsEnv(options: IntegrationsEnvOptions = {}): () => void {
  const previous = new Map(MANAGED.map((name) => [name, process.env[name]]));
  process.env.INTEGRATIONS_ENABLED = 'fake';
  if (options.secretFromEnv === false) delete process.env.FAKE_PROVIDER_TOKEN;
  else process.env.FAKE_PROVIDER_TOKEN = TEST_FAKE_TOKEN;
  process.env.INTEGRATIONS_KEYS = `k1:${randomBytes(32).toString('base64')}`;
  process.env.INTEGRATIONS_ACTIVE_KEY = 'k1';
  process.env.INTEGRATIONS_SCHEDULER_ENABLED = options.schedulerEnabled ? 'true' : 'false';
  if (options.tickSeconds !== undefined) {
    process.env.INTEGRATIONS_TICK_SECONDS = String(options.tickSeconds);
  }
  for (const [name, value] of Object.entries(options.extra ?? {})) process.env[name] = value;
  return () => {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    for (const name of Object.keys(options.extra ?? {})) {
      if (!previous.has(name)) delete process.env[name];
    }
  };
}

/** Logger real de la app (mismas rutas redactadas) escribiendo a memoria. */
function memoryLogger(): { logger: pino.Logger; lines: () => string[] } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });
  const options = buildLoggerOptions('debug', true).pinoHttp as pino.LoggerOptions;
  const { transport: _transport, ...rest } = options;
  return {
    logger: pino(rest, stream),
    lines: () =>
      chunks
        .join('')
        .split('\n')
        .filter((line) => line.trim() !== ''),
  };
}

export async function createIntegrationsApp(
  options: IntegrationsEnvOptions = {},
): Promise<IntegrationsTestApp> {
  const restoreEnv = applyIntegrationsEnv(options);
  const memory = memoryLogger();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(INTEGRATIONS_BASE_LOGGER)
    .useValue(memory.logger)
    .compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix(GLOBAL_PREFIX, { exclude: PREFIX_EXCLUDED_ROUTES });
  app.use(requestIdMiddleware);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.enableCors(buildCorsOptions(FRONTEND_URL));
  await app.init();
  return {
    app,
    prisma: app.get(PrismaService),
    fake: app.get(FakeConnector),
    logLines: memory.lines,
    restoreEnv,
    close: async () => {
      try {
        await app.close();
      } finally {
        restoreEnv();
      }
    },
  };
}

/** Otro ejecutor con otro `holder`, cableado con los mismos puertos que el de la app. */
export function buildExecutor(
  app: INestApplication,
  holder: string,
  yieldTurn?: () => Promise<void>,
): RunDueJobsUseCase {
  return new RunDueJobsUseCase(
    app.get(RUNNER_LEASE_REPOSITORY),
    app.get(INTEGRATION_JOB_REPOSITORY),
    app.get(INTEGRATION_SETTING_REPOSITORY),
    app.get(SYNC_RUN_REPOSITORY),
    app.get(CONNECTOR_REGISTRY),
    app.get(CREDENTIAL_RESOLVER),
    app.get(SNAPSHOT_STORE),
    app.get(RUN_LOGGER_FACTORY),
    app.get(CLOCK),
    yieldTurn ?? app.get(YIELD),
    app.get(INTEGRATIONS_SETTINGS),
    holder,
    app.get(RANDOM_SOURCE),
  );
}

/** Borra todo lo que los e2e crean para el proveedor `fake` y deja libre el arriendo. */
export async function cleanIntegrations(prisma: PrismaClient): Promise<void> {
  await prisma.integrationJob.deleteMany({ where: { provider: 'fake' } });
  await prisma.syncRun.deleteMany({ where: { provider: 'fake' } });
  await prisma.integrationSetting.deleteMany({ where: { provider: 'fake' } });
  await prisma.integrationCredential.deleteMany({ where: { provider: 'fake' } });
  await prisma.externalSnapshot.deleteMany({ where: { provider: 'fake' } });
  await prisma.$executeRaw`UPDATE "IntegrationRunnerLease" SET holder = '', "expiresAt" = TIMESTAMP '1970-01-01 00:00:00' WHERE id = 'runner'`;
}

export async function addJob(
  prisma: PrismaClient,
  data: {
    key: string;
    kind?: string;
    payload?: Record<string, unknown>;
    status?: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'DEAD';
    attempts?: number;
    runAt?: Date;
    lockedUntil?: Date | null;
    lockedBy?: string | null;
    finishedAt?: Date | null;
    maxAttempts?: number;
  },
): Promise<{ id: string }> {
  return prisma.integrationJob.create({
    data: {
      provider: 'fake',
      // Un tipo distinto por clave: el índice único parcial permite un solo trabajo activo por (proveedor, tipo).
      kind: data.kind ?? `sync-${data.key}`,
      idempotencyKey: data.key,
      payload: (data.payload ?? {}) as Prisma.InputJsonObject,
      status: data.status ?? 'PENDING',
      attempts: data.attempts ?? 0,
      maxAttempts: data.maxAttempts ?? 8,
      runAt: data.runAt ?? new Date(Date.now() - 1000),
      lockedUntil: data.lockedUntil ?? null,
      lockedBy: data.lockedBy ?? null,
      finishedAt: data.finishedAt ?? null,
    },
    select: { id: true },
  });
}
