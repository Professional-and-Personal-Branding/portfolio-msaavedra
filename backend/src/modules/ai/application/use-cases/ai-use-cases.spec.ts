import {
  aiSettings,
  CapturingLogger,
  counterIds,
  failWith,
  InMemoryAiStore,
  InstantLimiter,
  MutableClock,
  ScriptedLlm,
} from '../../../../../test/support/ai-doubles';
import { AiSettings } from '../ports/ai-support.ports';
import { AiTaskRunner } from '../services/ai-task-runner';
import { BudgetGuard } from '../services/budget-guard';
import { GetAiUsageUseCase } from './get-ai-usage.use-case';
import { RunAiSmokeTestUseCase } from './run-ai-smoke-test.use-case';

const NOW = new Date('2026-11-17T12:00:00Z');

function setup(overrides: Partial<AiSettings> = {}) {
  const settings = aiSettings(overrides);
  const store = new InMemoryAiStore();
  const clock = new MutableClock(NOW);
  const llm = new ScriptedLlm();
  const guard = new BudgetGuard(
    store,
    { capMicroUsd: settings.monthlyBudgetUsd * 1_000_000, requestTimeoutMs: 60_000 },
    clock,
  );
  const runner = new AiTaskRunner(
    llm,
    store,
    guard,
    clock,
    settings,
    counterIds(),
    new InstantLimiter(),
    new CapturingLogger(),
  );
  return {
    store,
    llm,
    usage: new GetAiUsageUseCase(store, store, settings, clock),
    smoke: new RunAiSmokeTestUseCase(runner, store),
  };
}

describe('GetAiUsageUseCase', () => {
  it('sin gasto: OK, 0 de 10 USD y la fecha de verificación de precios', async () => {
    const { usage } = setup();
    const out = await usage.execute();
    expect(out).toMatchObject({
      enabled: true,
      provider: 'fake',
      month: '2026-11',
      budgetUsd: 10,
      spentUsd: 0,
      reservedUsd: 0,
      remainingUsd: 10,
      percentUsed: 0,
      state: 'OK',
      pricingVerifiedAt: '2026-11-17',
      providerBlockedUntil: null,
      recentRuns: [],
    });
  });

  it('cerca del tope: NEAR_LIMIT y remainingUsd 1.9 con 8,10 gastados', async () => {
    const { usage, store } = setup();
    store.months.set('2026-11', {
      spent: 8_100_000,
      reserved: 0,
      blockedUntil: null,
      blockReason: null,
    });
    const out = await usage.execute();
    expect(out.state).toBe('NEAR_LIMIT');
    expect(out.remainingUsd).toBe(1.9);
    expect(out.percentUsed).toBe(81);
  });

  it('tope 0: EXHAUSTED', async () => {
    const { usage } = setup({ monthlyBudgetUsd: 0 });
    expect((await usage.execute()).state).toBe('EXHAUSTED');
  });

  it('IA apagada: DISABLED, pero igual informa el gasto del mes', async () => {
    const { usage, store } = setup({ enabled: false });
    store.months.set('2026-11', {
      spent: 1_230_000,
      reserved: 0,
      blockedUntil: null,
      blockReason: null,
    });
    const out = await usage.execute();
    expect(out.state).toBe('DISABLED');
    expect(out.spentUsd).toBe(1.23);
    expect(out.percentUsed).toBe(12);
  });

  it('bloqueo del proveedor vigente: PROVIDER_BLOCKED con su fecha y motivo', async () => {
    const { usage, store } = setup();
    store.months.set('2026-11', {
      spent: 0,
      reserved: 0,
      blockedUntil: new Date('2026-12-01T00:00:00Z'),
      blockReason: 'tope de gasto mensual alcanzado',
    });
    const out = await usage.execute();
    expect(out.state).toBe('PROVIDER_BLOCKED');
    expect(out.providerBlockedUntil).toBe('2026-12-01T00:00:00.000Z');
    expect(out.providerBlockReason).toBe('tope de gasto mensual alcanzado');
  });

  it('las corridas recientes no llevan entradas ni salidas', async () => {
    const { usage, smoke } = setup();
    await smoke.execute();
    const out = await usage.execute();
    expect(out.recentRuns).toHaveLength(1);
    expect(Object.keys(out.recentRuns[0])).not.toEqual(expect.arrayContaining(['output', 'input']));
    expect(JSON.stringify(out)).not.toContain('Verificación');
  });
});

describe('RunAiSmokeTestUseCase', () => {
  it('IA apagada: AiDisabledError', async () => {
    const { smoke } = setup({ enabled: false });
    const result = await smoke.execute();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe('La IA está apagada en este servidor');
  });

  it('dos pruebas seguidas llaman dos veces al adaptador y ninguna es CACHED', async () => {
    const { smoke, llm } = setup();
    const a = await smoke.execute();
    const b = await smoke.execute();
    expect(llm.completeCalls).toBe(2);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.value.status).toBe('SUCCEEDED');
      expect(b.value.status).toBe('SUCCEEDED');
      expect(b.value.fromCache).toBe(false);
    }
  });

  it('una llamada que falla se devuelve como corrida FAILED, no como error', async () => {
    const { smoke, llm } = setup();
    llm.queue(failWith({ kind: 'Transient', message: 'HTTP 529' }));
    const result = await smoke.execute();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('FAILED');
      expect(result.value.failureKind).toBe('Transient');
    }
  });

  it('tope 0: error 422 sin llamar al adaptador', async () => {
    const { smoke, llm } = setup({ monthlyBudgetUsd: 0 });
    const result = await smoke.execute();
    expect(result.ok).toBe(false);
    expect(llm.completeCalls).toBe(0);
  });
});
