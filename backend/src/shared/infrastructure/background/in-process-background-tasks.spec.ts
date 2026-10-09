import { Logger } from '@nestjs/common';
import { InProcessBackgroundTasks } from './in-process-background-tasks';

function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('InProcessBackgroundTasks', () => {
  let tasks: InProcessBackgroundTasks;
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    tasks = new InProcessBackgroundTasks();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('run no espera la tarea', async () => {
    const d = deferred();
    let started = false;
    tasks.run('t', () => {
      started = true;
      return d.promise;
    });
    expect(started).toBe(true);
    let idle = false;
    void tasks.whenIdle().then(() => (idle = true));
    await Promise.resolve();
    expect(idle).toBe(false);
    d.resolve();
    await tasks.whenIdle();
  });

  it('un rechazo se registra con el nombre y no queda sin manejar', async () => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    try {
      tasks.run('record-profile-view', () => Promise.reject(new Error('boom')));
      tasks.run('sync-throw', () => {
        throw new Error('sync');
      });
      await tasks.whenIdle();
      await new Promise((r) => setImmediate(r));
    } finally {
      process.off('unhandledRejection', unhandled);
    }
    expect(unhandled).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('record-profile-view'));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('boom'));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('sync-throw'));
  });

  it('whenIdle espera también las tareas lanzadas mientras espera', async () => {
    const first = deferred();
    const second = deferred();
    tasks.run('a', () => first.promise);
    let idle = false;
    const waiting = tasks.whenIdle().then(() => (idle = true));
    tasks.run('b', () => second.promise);
    first.resolve();
    await new Promise((r) => setImmediate(r));
    expect(idle).toBe(false);
    second.resolve();
    await waiting;
    expect(idle).toBe(true);
  });

  it('whenIdle resuelve de inmediato sin tareas', async () => {
    await expect(tasks.whenIdle()).resolves.toBeUndefined();
  });

  it('drain resuelve al vencer el tope con un aviso con la cantidad pendiente', async () => {
    jest.useFakeTimers();
    tasks.run('lenta', () => new Promise<void>(() => undefined));
    tasks.run('lenta-2', () => new Promise<void>(() => undefined));
    const drained = tasks.drain(5000);
    await jest.advanceTimersByTimeAsync(5000);
    await expect(drained).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/2 tarea/));
  });

  it('drain no avisa si las tareas terminan a tiempo', async () => {
    jest.useFakeTimers();
    const d = deferred();
    tasks.run('t', () => d.promise);
    const drained = tasks.drain(5000);
    d.resolve();
    await drained;
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
