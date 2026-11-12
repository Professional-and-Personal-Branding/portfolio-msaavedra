/* eslint-disable @typescript-eslint/require-await -- dobles asíncronos sin I/O real */
import { fail, ok } from '../../../../../shared/domain/result';
import { RunLogger } from '../../../application/ports/run-logger.port';
import { SnapshotStore } from '../../../application/ports/snapshot-store.port';
import { SyncContext } from '../../../application/ports/connector.port';
import { EnabledConnectorRegistry } from '../registry';
import { FakeConnector } from './fake.connector';

const log: RunLogger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

function ctx(payload: Record<string, unknown>, snapshots?: Partial<SnapshotStore>): SyncContext {
  return {
    jobId: 'j',
    provider: 'fake',
    payload,
    secret: 'token-de-prueba-xyz',
    snapshots: {
      get: jest.fn(),
      recordNotModified: jest.fn(async () => undefined),
      record: jest.fn(async () => ok({ changed: true })),
      ...snapshots,
    },
    log,
  };
}

const never = new AbortController().signal;

describe('FakeConnector', () => {
  it('ok escribe el snapshot fake:items y cuenta lo que cambió', async () => {
    const connector = new FakeConnector();
    const context = ctx({});
    expect(await connector.sync(context, never)).toEqual(ok({ itemsChanged: 1 }));
    expect(context.snapshots.record).toHaveBeenCalledWith('fake', 'fake:items', expect.anything());
    const same = ctx({}, { record: jest.fn(async () => ok({ changed: false })) });
    expect(await connector.sync(same, never)).toEqual(ok({ itemsChanged: 0 }));
  });

  it('un escenario desconocido se comporta como ok', async () => {
    expect((await new FakeConnector().sync(ctx({ scenario: 'nada' }), never)).ok).toBe(true);
  });

  it('not-modified solo mueve fetchedAt', async () => {
    const context = ctx({ scenario: 'not-modified' });
    expect((await new FakeConnector().sync(context, never)).ok).toBe(true);
    expect(context.snapshots.recordNotModified).toHaveBeenCalled();
    expect(context.snapshots.record).not.toHaveBeenCalled();
  });

  it.each([
    ['transient', 'Transient'],
    ['permanent', 'Permanent'],
    ['retry-after', 'RetryAfter'],
    ['reset-at', 'ResetAt'],
    ['budget', 'BudgetExhausted'],
    ['leak-secret', 'Transient'],
  ])('%s devuelve %s', async (scenario, kind) => {
    const result = await new FakeConnector().sync(ctx({ scenario }), never);
    expect(result).toEqual(fail(expect.objectContaining({ kind })));
  });

  it('leak-secret falla con un mensaje que contiene el token', async () => {
    const result = await new FakeConnector().sync(ctx({ scenario: 'leak-secret' }), never);
    expect(!result.ok && result.error.message).toContain('token-de-prueba-xyz');
  });

  it('throw lanza en vez de devolver', async () => {
    await expect(new FakeConnector().sync(ctx({ scenario: 'throw' }), never)).rejects.toThrow();
  });

  it('slow respeta la señal: abortada, termina enseguida', async () => {
    const controller = new AbortController();
    const started = Date.now();
    const pending = new FakeConnector().sync(ctx({ scenario: 'slow' }), controller.signal);
    setTimeout(() => controller.abort(), 50);
    const result = await pending;
    expect(result.ok).toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('slow completa los pasos si nadie aborta', async () => {
    const result = await new FakeConnector().sync(
      ctx({ scenario: 'slow', steps: 3, stepMs: 5, workMs: 1 }),
      never,
    );
    expect(result.ok).toBe(true);
  });

  it('ignore-abort NO escucha la señal: sigue hasta cumplir su tiempo', async () => {
    const controller = new AbortController();
    controller.abort();
    const started = Date.now();
    const result = await new FakeConnector().sync(
      ctx({ scenario: 'ignore-abort', ms: 80 }),
      controller.signal,
    );
    expect(result.ok).toBe(true);
    expect(Date.now() - started).toBeGreaterThanOrEqual(70);
  });

  it('cuenta las llamadas por escenario', async () => {
    const connector = new FakeConnector();
    await connector.sync(ctx({ scenario: 'transient' }), never);
    await connector.sync(ctx({ scenario: 'transient' }), never);
    await connector.sync(ctx({}), never);
    expect(connector.callsFor('transient')).toBe(2);
    expect(connector.callsFor('ok')).toBe(1);
    expect(connector.totalCalls).toBe(3);
    connector.resetCalls();
    expect(connector.totalCalls).toBe(0);
  });
});

describe('EnabledConnectorRegistry', () => {
  it('arma solo los conectores habilitados', () => {
    const fake = new FakeConnector();
    expect(new EnabledConnectorRegistry([], [fake]).ids()).toEqual([]);
    const registry = new EnabledConnectorRegistry(['fake'], [fake]);
    expect(registry.ids()).toEqual(['fake']);
    expect(registry.get('fake')).toBe(fake);
    expect(registry.get('github')).toBeUndefined();
  });

  it('un id sin conector hace fallar el arranque nombrando la variable', () => {
    expect(() => new EnabledConnectorRegistry(['gitlab'], [new FakeConnector()])).toThrow(
      /INTEGRATIONS_ENABLED/,
    );
  });
});
