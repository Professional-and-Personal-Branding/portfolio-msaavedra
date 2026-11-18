import { InMemoryAiStore, MutableClock } from '../../../../../test/support/ai-doubles';
import { AiRunIdentity } from '../../domain/ai-run.entity';
import { BudgetGuard, budgetMonthOf, CONSOLE_BLOCK_MS, ORPHAN_GRACE_MS } from './budget-guard';

const NOW = new Date('2026-11-17T12:00:00Z');
const CAP = 10_000_000; // 10 USD

function setup(cap = CAP) {
  const store = new InMemoryAiStore();
  const clock = new MutableClock(NOW);
  const guard = new BudgetGuard(store, { capMicroUsd: cap, requestTimeoutMs: 60_000 }, clock);
  let n = 0;
  const identity = (now: Date = clock.now()): AiRunIdentity => ({
    id: `r${++n}`,
    task: 'ai.smoke',
    promptVersion: 1,
    model: 'claude-haiku-5-5',
    inputHash: 'h',
    cacheKey: `k${n}`,
    budgetMonth: budgetMonthOf(now),
    now,
  });
  return { store, clock, guard, identity };
}

describe('budgetMonthOf', () => {
  it('es el mes calendario UTC', () => {
    expect(budgetMonthOf(new Date('2026-11-17T12:00:00Z'))).toBe('2026-11');
    expect(budgetMonthOf(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01');
  });

  it('a las 23:59 UTC del último día sigue siendo el mes viejo; un minuto después, el nuevo', () => {
    expect(budgetMonthOf(new Date('2026-11-30T23:59:00Z'))).toBe('2026-11');
    expect(budgetMonthOf(new Date('2026-12-01T00:00:00Z'))).toBe('2026-12');
    expect(budgetMonthOf(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12');
  });

  it('usa UTC aunque la hora local sea del día siguiente', () => {
    // 2026-11-30T22:00 en Bolivia (UTC-4) es 2026-12-01T02:00Z
    expect(budgetMonthOf(new Date('2026-12-01T02:00:00Z'))).toBe('2026-12');
  });
});

describe('BudgetGuard.reserve', () => {
  it('concede una reserva que entra y deja el reservado en el contador', async () => {
    const { guard, store, identity } = setup();
    const result = await guard.reserve(identity(), 3_000_000);
    expect(result.ok).toBe(true);
    expect(store.snapshot('2026-11')).toEqual({ spent: 0, reserved: 3_000_000 });
  });

  it('el tope exacto entra; un micro-USD más, no', async () => {
    const { guard, identity } = setup();
    expect((await guard.reserve(identity(), CAP)).ok).toBe(true);
    const second = await guard.reserve(identity(), 1);
    expect(second.ok).toBe(false);
  });

  it('una reserva que haría pasar el tope se rechaza aunque no se haya llegado todavía', async () => {
    const { guard, store, identity } = setup();
    store.months.set('2026-11', {
      spent: 9_950_000,
      reserved: 0,
      blockedUntil: null,
      blockReason: null,
    });
    const result = await guard.reserve(identity(), 100_000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reason).toBe('cap');
      expect(result.error.message).toBe('Se alcanzó el tope de IA del mes');
    }
    expect(store.snapshot('2026-11')).toEqual({ spent: 9_950_000, reserved: 0 });
  });

  it('con tope 0 todo se rechaza', async () => {
    const { guard, identity } = setup(0);
    expect((await guard.reserve(identity(), 1)).ok).toBe(false);
  });

  it('la reserva vence a timeout + 60 s', async () => {
    const { guard, identity } = setup();
    const result = await guard.reserve(identity(), 10);
    if (!result.ok) throw new Error('se esperaba ok');
    expect(result.value.props.reservationExpiresAt).toEqual(
      new Date(NOW.getTime() + 60_000 + ORPHAN_GRACE_MS),
    );
  });

  it('un bloqueo vigente del proveedor rechaza sin tocar el contador', async () => {
    const { guard, store, identity } = setup();
    await guard.blockProvider('2026-11', new Date('2026-12-01T00:00:00Z'), 'tope del tier');
    const result = await guard.reserve(identity(), 10);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reason).toBe('provider');
      expect(result.error.blockedUntil).toEqual(new Date('2026-12-01T00:00:00Z'));
    }
    expect(store.snapshot('2026-11').reserved).toBe(0);
  });
});

describe('BudgetGuard.settle', () => {
  it('costo menor que la reserva: baja el reservado y sube el gastado por el costo real', async () => {
    const { guard, store, identity } = setup();
    const reserved = await guard.reserve(identity(), 200);
    if (!reserved.ok) throw new Error('se esperaba ok');
    const closed = await guard.settle(reserved.value, {
      status: 'SUCCEEDED',
      costMicroUsd: 50,
      durationMs: 10,
      finishedAt: NOW,
    });
    expect(closed.status).toBe('SUCCEEDED');
    expect(store.snapshot('2026-11')).toEqual({ spent: 50, reserved: 0 });
  });

  it('costo mayor que la reserva: el exceso se imputa igual', async () => {
    const { guard, store, identity } = setup();
    const reserved = await guard.reserve(identity(), 100);
    if (!reserved.ok) throw new Error('se esperaba ok');
    await guard.settle(reserved.value, {
      status: 'SUCCEEDED',
      costMicroUsd: 130,
      durationMs: 10,
      finishedAt: NOW,
    });
    expect(store.snapshot('2026-11')).toEqual({ spent: 130, reserved: 0 });
  });

  it('un fallo sin uso libera la reserva sin costo', async () => {
    const { guard, store, identity } = setup();
    const reserved = await guard.reserve(identity(), 500);
    if (!reserved.ok) throw new Error('se esperaba ok');
    await guard.settle(reserved.value, {
      status: 'FAILED',
      costMicroUsd: 0,
      failureKind: 'Transient',
      durationMs: 10,
      finishedAt: NOW,
    });
    expect(store.snapshot('2026-11')).toEqual({ spent: 0, reserved: 0 });
  });

  it('un timeout imputa la reserva entera', async () => {
    const { guard, store, identity } = setup();
    const reserved = await guard.reserve(identity(), 500);
    if (!reserved.ok) throw new Error('se esperaba ok');
    await guard.settle(reserved.value, {
      status: 'FAILED',
      costMicroUsd: 500,
      failureKind: 'Transient',
      durationMs: 60_000,
      finishedAt: NOW,
    });
    expect(store.snapshot('2026-11')).toEqual({ spent: 500, reserved: 0 });
  });
});

describe('BudgetGuard — reservas huérfanas', () => {
  it('una RESERVED vencida pasa a ABANDONED, su reserva pasa a gastado y recién después se evalúa la nueva', async () => {
    const { guard, store, clock, identity } = setup(1000);
    const first = await guard.reserve(identity(), 900);
    if (!first.ok) throw new Error('se esperaba ok');
    // Todavía vigente: la nueva no entra.
    expect((await guard.reserve(identity(), 200)).ok).toBe(false);
    clock.advance(60_000 + ORPHAN_GRACE_MS + 1);
    // Vencida: se abandona (900 pasan a gastado) y la nueva de 50 entra.
    const next = await guard.reserve(identity(), 50);
    expect(next.ok).toBe(true);
    expect(store.runs.get(first.value.id)?.status).toBe('ABANDONED');
    expect(store.snapshot('2026-11')).toEqual({ spent: 900, reserved: 50 });
  });

  it('una conciliación tardía de una corrida ya abandonada no duplica el cargo', async () => {
    const { guard, store, clock, identity } = setup();
    const first = await guard.reserve(identity(), 400);
    if (!first.ok) throw new Error('se esperaba ok');
    clock.advance(60_000 + ORPHAN_GRACE_MS + 1);
    await guard.reserve(identity(), 10);
    await guard.settle(first.value, {
      status: 'SUCCEEDED',
      costMicroUsd: 100,
      durationMs: 1,
      finishedAt: clock.now(),
    });
    expect(store.snapshot('2026-11')).toEqual({ spent: 400, reserved: 10 });
  });
});

describe('BudgetGuard.blockProvider', () => {
  it('con fecha de reinicio futura bloquea hasta esa fecha', async () => {
    const { guard } = setup();
    const until = await guard.blockProvider('2026-11', new Date('2026-12-01T00:00:00Z'), 'x');
    expect(until).toEqual(new Date('2026-12-01T00:00:00Z'));
  });

  it('sin fecha (Console) bloquea una hora', async () => {
    const { guard } = setup();
    const until = await guard.blockProvider('2026-11', undefined, 'x');
    expect(until).toEqual(new Date(NOW.getTime() + CONSOLE_BLOCK_MS));
  });

  it('una fecha pasada o inválida se trata como sin fecha', async () => {
    const { guard } = setup();
    const past = await guard.blockProvider('2026-11', new Date('2026-01-01T00:00:00Z'), 'x');
    expect(past).toEqual(new Date(NOW.getTime() + CONSOLE_BLOCK_MS));
    const invalid = await guard.blockProvider('2026-11', new Date('nope'), 'x');
    expect(invalid).toEqual(new Date(NOW.getTime() + CONSOLE_BLOCK_MS));
  });

  it('una fecha lejanísima se acota a 35 días', async () => {
    const { guard } = setup();
    const until = await guard.blockProvider('2026-11', new Date('2030-01-01T00:00:00Z'), 'x');
    expect(until.getTime()).toBe(NOW.getTime() + 35 * 24 * 60 * 60 * 1000);
  });
});

describe('BudgetGuard — avisos y reserva abandonada (B3, B4)', () => {
  function withLogger() {
    const store = new InMemoryAiStore();
    const clock = new MutableClock(NOW);
    const warnings: Array<{ message: string; data: Record<string, unknown> }> = [];
    const guard = new BudgetGuard(store, { capMicroUsd: CAP, requestTimeoutMs: 60_000 }, clock, {
      warn: (message, data) => warnings.push({ message, data }),
    });
    const identity = (): AiRunIdentity => ({
      id: 'r1',
      task: 'ai.smoke',
      promptVersion: 1,
      model: 'claude-haiku-5-5',
      inputHash: 'h',
      cacheKey: 'k',
      budgetMonth: '2026-11',
      now: clock.now(),
    });
    return { store, clock, guard, warnings, identity };
  }

  it('B3: avisa cuando el costo liquidado supera lo reservado, sin datos sensibles', async () => {
    const { guard, warnings, identity } = withLogger();
    const reserved = await guard.reserve(identity(), 100);
    if (!reserved.ok) throw new Error('se esperaba ok');
    await guard.settle(reserved.value, {
      status: 'SUCCEEDED',
      costMicroUsd: 150,
      durationMs: 1,
      finishedAt: NOW,
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].data).toEqual({
      aiRunId: 'r1',
      task: 'ai.smoke',
      reservedMicroUsd: 100,
      costMicroUsd: 150,
    });
  });

  it('B3: no avisa si el costo no supera la reserva', async () => {
    const { guard, warnings, identity } = withLogger();
    const reserved = await guard.reserve(identity(), 100);
    if (!reserved.ok) throw new Error('se esperaba ok');
    await guard.settle(reserved.value, {
      status: 'SUCCEEDED',
      costMicroUsd: 100,
      durationMs: 1,
      finishedAt: NOW,
    });
    expect(warnings).toEqual([]);
  });

  it('B4: si la reserva ya estaba abandonada, la corrida no queda SUCCEEDED y se loguea', async () => {
    const { guard, store, clock, warnings, identity } = withLogger();
    const reserved = await guard.reserve(identity(), 400);
    if (!reserved.ok) throw new Error('se esperaba ok');
    clock.advance(60_000 + ORPHAN_GRACE_MS + 1);
    await store.abandonExpired(clock.now());
    const closed = await guard.settle(reserved.value, {
      status: 'SUCCEEDED',
      costMicroUsd: 90,
      durationMs: 1,
      finishedAt: clock.now(),
    });
    expect(closed.status).toBe('ABANDONED');
    expect(closed.props.costMicroUsd).toBe(400);
    expect(closed.props.failureKind).toBe('Abandoned');
    expect(warnings.map((w) => w.message).join(' ')).toContain('abandonada');
    // El gasto no se duplica: sigue siendo la reserva entera, una vez.
    expect(store.snapshot('2026-11')).toEqual({ spent: 400, reserved: 0 });
  });
});
