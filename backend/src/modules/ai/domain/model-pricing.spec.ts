import {
  ALLOWED_MODELS,
  HAIKU_LONG_PROMPT_THRESHOLD,
  isAllowedModel,
  PRICING_VERIFIED_AT,
  ratesFor,
} from './model-pricing';

// Fija la tabla de design.md § Presupuesto (USD por millón de tokens × 1 000 000).
describe('model-pricing', () => {
  it('la fecha de verificación es la del cambio', () => {
    expect(PRICING_VERIFIED_AT).toBe('2026-11-17');
  });

  it('Haiku 5.5 hasta 100K: 0,10 / 0,125 / 0,01 / 0,50', () => {
    expect(ratesFor('claude-haiku-5-5', 1000)).toEqual({
      input: 100_000,
      cacheWrite5m: 125_000,
      cacheRead: 10_000,
      output: 500_000,
    });
  });

  it('Haiku 5.5 cambia de tarifa por encima de 100 000 tokens de entrada', () => {
    expect(ratesFor('claude-haiku-5-5', HAIKU_LONG_PROMPT_THRESHOLD)).toMatchObject({
      input: 100_000,
    });
    expect(ratesFor('claude-haiku-5-5', HAIKU_LONG_PROMPT_THRESHOLD + 1)).toEqual({
      input: 500_000,
      cacheWrite5m: 625_000,
      cacheRead: 50_000,
      output: 2_500_000,
    });
  });

  it('Sonnet 5.5: 2 / 2,50 / 0,10 / 10', () => {
    expect(ratesFor('claude-sonnet-5-5', 1)).toEqual({
      input: 2_000_000,
      cacheWrite5m: 2_500_000,
      cacheRead: 100_000,
      output: 10_000_000,
    });
  });

  it('el registro solo permite Haiku 5.5 y Sonnet 5.5 (Opus queda fuera, P2)', () => {
    expect([...ALLOWED_MODELS]).toEqual(['claude-haiku-5-5', 'claude-sonnet-5-5']);
    expect(isAllowedModel('claude-opus-5-5')).toBe(false);
    expect(isAllowedModel('claude-haiku-5-5')).toBe(true);
  });
});
