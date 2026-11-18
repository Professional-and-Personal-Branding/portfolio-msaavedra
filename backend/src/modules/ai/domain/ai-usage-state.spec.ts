import { computeAiUsageState } from './ai-usage-state';

const NOW = new Date('2026-11-17T12:00:00Z');
const base = {
  enabled: true,
  capMicroUsd: 10_000_000,
  spentMicroUsd: 0,
  reservedMicroUsd: 0,
  providerBlockedUntil: null,
  now: NOW,
};

describe('computeAiUsageState', () => {
  it('apagada → DISABLED, aunque haya gasto', () => {
    expect(computeAiUsageState({ ...base, enabled: false, spentMicroUsd: 99_000_000 })).toBe(
      'DISABLED',
    );
  });
  it('sin gasto → OK', () => {
    expect(computeAiUsageState(base)).toBe('OK');
  });
  it('justo debajo del 80 % → OK; en el 80 % → NEAR_LIMIT', () => {
    expect(computeAiUsageState({ ...base, spentMicroUsd: 7_999_999 })).toBe('OK');
    expect(computeAiUsageState({ ...base, spentMicroUsd: 8_000_000 })).toBe('NEAR_LIMIT');
    expect(computeAiUsageState({ ...base, spentMicroUsd: 8_100_000 })).toBe('NEAR_LIMIT');
  });
  it('el reservado también cuenta', () => {
    expect(
      computeAiUsageState({ ...base, spentMicroUsd: 5_000_000, reservedMicroUsd: 3_000_000 }),
    ).toBe('NEAR_LIMIT');
  });
  it('gastado + reservado ≥ tope → EXHAUSTED', () => {
    expect(computeAiUsageState({ ...base, spentMicroUsd: 10_000_000 })).toBe('EXHAUSTED');
    expect(
      computeAiUsageState({ ...base, spentMicroUsd: 9_000_000, reservedMicroUsd: 1_000_000 }),
    ).toBe('EXHAUSTED');
  });
  it('tope 0 → EXHAUSTED', () => {
    expect(computeAiUsageState({ ...base, capMicroUsd: 0 })).toBe('EXHAUSTED');
  });
  it('bloqueo vigente del proveedor → PROVIDER_BLOCKED; vencido, no', () => {
    expect(
      computeAiUsageState({ ...base, providerBlockedUntil: new Date('2026-12-01T00:00:00Z') }),
    ).toBe('PROVIDER_BLOCKED');
    expect(
      computeAiUsageState({ ...base, providerBlockedUntil: new Date('2026-11-17T11:00:00Z') }),
    ).toBe('OK');
  });
  it('el tope propio gana sobre el bloqueo del proveedor', () => {
    expect(
      computeAiUsageState({
        ...base,
        spentMicroUsd: 10_000_000,
        providerBlockedUntil: new Date('2026-12-01T00:00:00Z'),
      }),
    ).toBe('EXHAUSTED');
  });
});
