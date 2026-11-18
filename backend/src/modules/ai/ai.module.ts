import { randomUUID } from 'crypto';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import type { Logger } from 'pino';
import { APP_CONFIG, AppConfig } from '../../config/configuration';
import { CLOCK, Clock, systemClock } from '../../shared/domain/clock';
import { AI_BUDGET_REPOSITORY, AI_RUN_REPOSITORY } from './application/ports/ai-repositories';
import {
  AI_CONCURRENCY_LIMITER,
  AI_NEW_ID,
  AI_RUN_LOGGER,
  AI_SETTINGS,
  AI_TASK_RUNNER,
  AiSettings,
} from './application/ports/ai-support.ports';
import { LLM_PORT, LlmPort } from './application/ports/llm.port';
import { AiTaskRunner, BUDGET_GUARD } from './application/services/ai-task-runner';
import { BudgetGuard } from './application/services/budget-guard';
import { AI_TASKS } from './application/tasks/registry';
import { GetAiUsageUseCase } from './application/use-cases/get-ai-usage.use-case';
import { RunAiSmokeTestUseCase } from './application/use-cases/run-ai-smoke-test.use-case';
import { AiBudgetRepository } from './application/ports/ai-repositories';
import { usdToMicro } from './domain/estimate-cost';
import { AiFakeScenario } from './domain/fake-scenarios';
import { AdminAiController } from './infrastructure/controllers/admin-ai.controller';
import {
  ANTHROPIC_CLIENT_FACTORY,
  AnthropicClientFactory,
  createAnthropicClient,
} from './infrastructure/anthropic/anthropic-client.factory';
import { AnthropicLlmAdapter } from './infrastructure/anthropic/anthropic-llm.adapter';
import { Semaphore } from './infrastructure/concurrency/semaphore';
import { DisabledLlmAdapter } from './infrastructure/disabled/disabled-llm.adapter';
import { FakeLlmAdapter } from './infrastructure/fake/fake-llm.adapter';
import { collectKnownSecrets } from './infrastructure/known-secrets';
import { AI_BASE_LOGGER, PinoAiRunLogger } from './infrastructure/logging/pino-ai-run-logger';
import { PrismaAiBudgetRepository } from './infrastructure/persistence/prisma-ai-budget.repository';
import { PrismaAiRunRepository } from './infrastructure/persistence/prisma-ai-run.repository';

/**
 * Base de IA (change `add-ai-foundation`): puerto hacia el modelo, presupuesto mensual con
 * reserva, registro de cada corrida y panel de solo lectura. Con `AI_ENABLED=false` (default) el
 * cliente del SDK no se construye. Ningún módulo de la ruta pública lo importa (test de arquitectura).
 */
@Module({
  controllers: [AdminAiController],
  providers: [
    {
      provide: AI_SETTINGS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AiSettings => {
        const app = config.getOrThrow<AppConfig>(APP_CONFIG);
        return {
          enabled: app.ai.enabled,
          provider: app.ai.provider,
          monthlyBudgetUsd: app.ai.monthlyBudgetUsd,
          requestTimeoutMs: app.ai.requestTimeoutMs,
          maxConcurrency: app.ai.maxConcurrency,
          maxInputTokens: app.ai.maxInputTokens,
          knownSecrets: collectKnownSecrets(app),
        };
      },
    },
    { provide: CLOCK, useValue: systemClock },
    { provide: AI_NEW_ID, useValue: randomUUID },
    {
      provide: AI_CONCURRENCY_LIMITER,
      inject: [AI_SETTINGS],
      useFactory: (settings: AiSettings) => new Semaphore(settings.maxConcurrency),
    },
    { provide: ANTHROPIC_CLIENT_FACTORY, useValue: createAnthropicClient },
    {
      provide: LLM_PORT,
      inject: [ConfigService, AI_SETTINGS, ANTHROPIC_CLIENT_FACTORY],
      useFactory: (
        config: ConfigService,
        settings: AiSettings,
        clientFactory: AnthropicClientFactory,
      ): LlmPort => {
        const app = config.getOrThrow<AppConfig>(APP_CONFIG);
        // Apagada: el cliente del SDK ni se construye.
        if (!settings.enabled) return new DisabledLlmAdapter();
        if (settings.provider === 'fake') {
          return new FakeLlmAdapter({
            scenario: app.ai.fakeScenario as AiFakeScenario,
            timeoutMs: settings.requestTimeoutMs,
            tasks: AI_TASKS,
          });
        }
        // El arranque ya garantizó la clave con la IA encendida y el proveedor `anthropic`.
        const apiKey = app.ai.apiKey ?? '';
        return new AnthropicLlmAdapter(
          clientFactory({ apiKey, timeoutMs: settings.requestTimeoutMs }),
          { timeoutMs: settings.requestTimeoutMs, knownSecrets: settings.knownSecrets },
        );
      },
    },
    { provide: AI_RUN_REPOSITORY, useClass: PrismaAiRunRepository },
    { provide: AI_BUDGET_REPOSITORY, useClass: PrismaAiBudgetRepository },
    {
      provide: BUDGET_GUARD,
      inject: [AI_BUDGET_REPOSITORY, AI_SETTINGS, CLOCK, AI_BASE_LOGGER],
      useFactory: (
        repository: AiBudgetRepository,
        settings: AiSettings,
        clock: Clock,
        base: Logger,
      ) =>
        new BudgetGuard(
          repository,
          {
            capMicroUsd: usdToMicro(settings.monthlyBudgetUsd),
            requestTimeoutMs: settings.requestTimeoutMs,
          },
          clock,
          { warn: (message, data) => base.warn(data, message) },
        ),
    },
    {
      provide: AI_BASE_LOGGER,
      inject: [PinoLogger],
      useFactory: (logger: PinoLogger): Logger => logger.logger,
    },
    {
      provide: AI_RUN_LOGGER,
      inject: [AI_BASE_LOGGER],
      useFactory: (base: Logger) => new PinoAiRunLogger(base),
    },
    AiTaskRunner,
    { provide: AI_TASK_RUNNER, useExisting: AiTaskRunner },
    GetAiUsageUseCase,
    RunAiSmokeTestUseCase,
  ],
  // Los casos de uso de IA de cada feature (módulos dueños del dato) reciben el runner por token.
  exports: [AI_TASK_RUNNER],
})
export class AiModule {}
