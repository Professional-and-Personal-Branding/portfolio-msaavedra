import { hostname } from 'os';
import { randomUUID } from 'crypto';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';
import type { Logger } from 'pino';
import { APP_CONFIG, AppConfig } from '../../config/configuration';
import { CLOCK, systemClock } from '../../shared/domain/clock';
import { CONNECTOR_REGISTRY } from './application/ports/connector.port';
import { CREDENTIAL_RESOLVER } from './application/ports/credential-resolver.port';
import {
  INTEGRATIONS_SETTINGS,
  RANDOM_SOURCE,
  RUNNER_HOLDER,
} from './application/ports/integrations-settings.port';
import { RUN_LOGGER_FACTORY } from './application/ports/run-logger.port';
import { SECRET_CIPHER } from './application/ports/secret-cipher.port';
import { SNAPSHOT_STORE } from './application/ports/snapshot-store.port';
import { setImmediateYield, YIELD } from './application/ports/yield.port';
import { IntegrationStatusReader } from './application/services/integration-status.reader';
import { SnapshotStoreService } from './application/services/snapshot-store.service';
import { DeleteCredentialUseCase } from './application/use-cases/delete-credential.use-case';
import { EnqueueSyncUseCase } from './application/use-cases/enqueue-sync.use-case';
import { ListIntegrationsUseCase } from './application/use-cases/list-integrations.use-case';
import { PlanDueSyncsUseCase } from './application/use-cases/plan-due-syncs.use-case';
import { RunDueJobsUseCase } from './application/use-cases/run-due-jobs.use-case';
import { SaveCredentialUseCase } from './application/use-cases/save-credential.use-case';
import { SetIntegrationEnabledUseCase } from './application/use-cases/set-integration-enabled.use-case';
import { CREDENTIAL_REPOSITORY } from './domain/repositories/credential.repository';
import { INTEGRATION_JOB_REPOSITORY } from './domain/repositories/integration-job.repository';
import { INTEGRATION_SETTING_REPOSITORY } from './domain/repositories/integration-setting.repository';
import { RUNNER_LEASE_REPOSITORY } from './domain/repositories/runner-lease.repository';
import { SNAPSHOT_REPOSITORY } from './domain/repositories/snapshot.repository';
import { SYNC_RUN_REPOSITORY } from './domain/repositories/sync-run.repository';
import { AdminIntegrationsController } from './infrastructure/controllers/admin-integrations.controller';
import { AesGcmSecretCipher } from './infrastructure/crypto/aes-gcm-secret-cipher';
import { Keyring } from './infrastructure/crypto/keyring';
import {
  INTEGRATIONS_BASE_LOGGER,
  PinoRunLoggerFactory,
} from './infrastructure/logging/pino-run-logger.factory';
import { CredentialResolverService } from './infrastructure/persistence/credential-resolver.service';
import { PrismaCredentialRepository } from './infrastructure/persistence/prisma-credential.repository';
import { PrismaIntegrationJobRepository } from './infrastructure/persistence/prisma-integration-job.repository';
import { PrismaIntegrationSettingRepository } from './infrastructure/persistence/prisma-integration-setting.repository';
import { PrismaRunnerLeaseRepository } from './infrastructure/persistence/prisma-runner-lease.repository';
import { PrismaSnapshotRepository } from './infrastructure/persistence/prisma-snapshot.repository';
import { PrismaSyncRunRepository } from './infrastructure/persistence/prisma-sync-run.repository';
import { FakeConnector } from './infrastructure/providers/fake/fake.connector';
import { EnabledConnectorRegistry } from './infrastructure/providers/registry';
import {
  INTEGRATIONS_CONFIG,
  IntegrationsScheduler,
  ShutdownSignal,
} from './infrastructure/scheduler/integrations-scheduler';
import { IntegrationsShutdown } from './infrastructure/scheduler/integrations-shutdown';

/**
 * Base de integraciones con terceros (change `add-integrations-foundation`): cola con
 * reintentos, scheduler en proceso (apagado por defecto), credenciales cifradas, snapshots y
 * estado por proveedor. Ningún módulo de la ruta pública lo importa (test de arquitectura).
 */
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [AdminIntegrationsController],
  providers: [
    {
      provide: INTEGRATIONS_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.getOrThrow<AppConfig>(APP_CONFIG).integrations,
    },
    {
      provide: INTEGRATIONS_SETTINGS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.getOrThrow<AppConfig>(APP_CONFIG).integrations,
    },
    { provide: CLOCK, useValue: systemClock },
    { provide: RANDOM_SOURCE, useValue: Math.random },
    { provide: YIELD, useValue: setImmediateYield },
    { provide: RUNNER_HOLDER, useFactory: () => `${hostname()}:${process.pid}:${randomUUID()}` },
    { provide: RUNNER_LEASE_REPOSITORY, useClass: PrismaRunnerLeaseRepository },
    { provide: INTEGRATION_JOB_REPOSITORY, useClass: PrismaIntegrationJobRepository },
    { provide: INTEGRATION_SETTING_REPOSITORY, useClass: PrismaIntegrationSettingRepository },
    { provide: SYNC_RUN_REPOSITORY, useClass: PrismaSyncRunRepository },
    { provide: SNAPSHOT_REPOSITORY, useClass: PrismaSnapshotRepository },
    { provide: CREDENTIAL_REPOSITORY, useClass: PrismaCredentialRepository },
    {
      provide: SECRET_CIPHER,
      inject: [INTEGRATIONS_CONFIG],
      useFactory: (config: AppConfig['integrations']) =>
        // Sin proveedores habilitados no hay nada que cifrar: keyring vacío, la API nunca cae por el keyring.
        new AesGcmSecretCipher(
          config.enabledProviders.length === 0
            ? new Keyring(new Map(), '')
            : Keyring.fromConfig(config.keys, config.activeKeyId),
        ),
    },
    { provide: CREDENTIAL_RESOLVER, useClass: CredentialResolverService },
    { provide: SNAPSHOT_STORE, useClass: SnapshotStoreService },
    {
      provide: INTEGRATIONS_BASE_LOGGER,
      inject: [PinoLogger],
      useFactory: (logger: PinoLogger): Logger => logger.logger,
    },
    {
      provide: RUN_LOGGER_FACTORY,
      inject: [INTEGRATIONS_BASE_LOGGER],
      useFactory: (base: Logger) => new PinoRunLoggerFactory(base),
    },
    FakeConnector,
    {
      provide: CONNECTOR_REGISTRY,
      inject: [INTEGRATIONS_CONFIG, FakeConnector],
      useFactory: (config: AppConfig['integrations'], fake: FakeConnector) =>
        new EnabledConnectorRegistry(config.enabledProviders, [fake]),
    },
    IntegrationStatusReader,
    ListIntegrationsUseCase,
    EnqueueSyncUseCase,
    SetIntegrationEnabledUseCase,
    SaveCredentialUseCase,
    DeleteCredentialUseCase,
    PlanDueSyncsUseCase,
    RunDueJobsUseCase,
    ShutdownSignal,
    IntegrationsScheduler,
    IntegrationsShutdown,
  ],
})
export class IntegrationsModule {}
