/* eslint-disable @typescript-eslint/require-await -- dobles asíncronos sin I/O real */
import { SchedulerRegistry } from '@nestjs/schedule';
import type { IntegrationsConfig } from '../../../../config/configuration';
import { InProcessBackgroundTasks } from '../../../../shared/infrastructure/background/in-process-background-tasks';
import { RunLoggerFactory } from '../../application/ports/run-logger.port';
import { PlanDueSyncsUseCase } from '../../application/use-cases/plan-due-syncs.use-case';
import { RunDueJobsUseCase } from '../../application/use-cases/run-due-jobs.use-case';
import { IntegrationsScheduler, ShutdownSignal } from './integrations-scheduler';
import { IntegrationsShutdown } from './integrations-shutdown';

const CONFIG: IntegrationsConfig = {
  enabledProviders: ['fake'],
  schedulerEnabled: true,
  syncCron: '0 10 * * *',
  tickSeconds: 60,
  jobTimeoutMs: 120_000,
  runMaxMs: 300_000,
  keys: undefined,
  activeKeyId: undefined,
  githubTransport: 'http',
};

function setup(overrides: Partial<IntegrationsConfig> = {}, runDuration = 0) {
  const registry = new SchedulerRegistry();
  const info = jest.fn();
  const loggers = {
    general: () => ({ debug: jest.fn(), info, warn: jest.fn(), error: jest.fn() }),
    forRun: jest.fn(),
  } as unknown as RunLoggerFactory;
  const execute = jest.fn(() => new Promise<void>((resolve) => setTimeout(resolve, runDuration)));
  const run = { execute } as unknown as RunDueJobsUseCase;
  const plan = { execute: jest.fn(async () => undefined) } as unknown as PlanDueSyncsUseCase;
  const background = new InProcessBackgroundTasks();
  const shutdown = new ShutdownSignal();
  const scheduler = new IntegrationsScheduler(
    registry,
    { ...CONFIG, ...overrides },
    plan,
    run,
    background,
    shutdown,
    loggers,
  );
  return { scheduler, registry, info, execute, background, shutdown, plan };
}

describe('IntegrationsScheduler', () => {
  afterEach(() => jest.useRealTimers());

  it('sin el flag no registra ningún timer y lo dice en el log', () => {
    const { scheduler, registry, info } = setup({ schedulerEnabled: false });
    scheduler.onApplicationBootstrap();
    expect(registry.getCronJobs().size).toBe(0);
    expect(registry.getIntervals()).toEqual([]);
    expect(info).toHaveBeenCalledWith('Integraciones: scheduler apagado');
  });

  it('con el flag registra el cron en UTC y el intervalo, y lo dice en el log', () => {
    const { scheduler, registry, info } = setup();
    try {
      scheduler.onApplicationBootstrap();
      const cron = registry.getCronJob('integrations-plan');
      expect(cron.cronTime.source).toBe('0 10 * * *');
      expect(cron.cronTime.timeZone).toBe('UTC');
      expect(registry.getIntervals()).toEqual(['integrations-run']);
      expect(info).toHaveBeenCalledWith('Integraciones: scheduler encendido (proveedores: fake)');
    } finally {
      scheduler.stopTimers();
    }
  });

  it('el callback del tick vuelve en menos de 5 ms aunque la corrida tarde 2 s', async () => {
    const { scheduler, execute, background } = setup({}, 2000);
    const started = performance.now();
    scheduler.tick();
    const elapsed = performance.now() - started;
    expect(elapsed).toBeLessThan(5);
    expect(execute).toHaveBeenCalledTimes(1);
    await background.whenIdle();
  }, 10_000);

  it('un segundo tick con la corrida en curso no lanza otra', async () => {
    const { scheduler, execute, background } = setup({}, 200);
    scheduler.tick();
    scheduler.tick();
    scheduler.tick();
    expect(execute).toHaveBeenCalledTimes(1);
    await background.whenIdle();
    // Terminada la corrida, el tick siguiente vuelve a lanzar.
    scheduler.tick();
    expect(execute).toHaveBeenCalledTimes(2);
    await background.whenIdle();
  });

  it('una corrida que lanza no deja el flag trabado', async () => {
    const { scheduler, execute, background } = setup();
    execute.mockImplementationOnce(() => Promise.reject(new Error('boom')));
    scheduler.tick();
    await background.whenIdle();
    scheduler.tick();
    expect(execute).toHaveBeenCalledTimes(2);
    await background.whenIdle();
  });

  it('el ejecutor recibe la señal de apagado compartida', async () => {
    const { scheduler, execute, background, shutdown } = setup();
    scheduler.tick();
    await background.whenIdle();
    expect(execute).toHaveBeenCalledWith({ shutdown: shutdown.signal });
  });
});

describe('IntegrationsShutdown', () => {
  it('detiene los timers y aborta la señal', () => {
    const { scheduler, registry, shutdown } = setup();
    scheduler.onApplicationBootstrap();
    new IntegrationsShutdown(scheduler, shutdown).onModuleDestroy();
    expect(registry.getCronJobs().size).toBe(0);
    expect(registry.getIntervals()).toEqual([]);
    expect(shutdown.signal.aborted).toBe(true);
  });
});
