import * as fc from 'fast-check';
import {
  computeCost,
  estimatedInputTokens,
  estimateReservation,
  microToUsd,
  usdToMicro,
} from './estimate-cost';

describe('estimateReservation', () => {
  it('suma la entrada con margen (10 % + 512) y max_tokens a precio de salida', () => {
    // Haiku: (ceil(1000 × 1,1) + 512) = 1612 tokens × 0,1 + 256 × 0,5 = 161,2 + 128 = 289,2 → 290
    expect(
      estimateReservation({
        model: 'claude-haiku-5-5',
        countedInputTokens: 1000,
        maxTokens: 256,
        cacheSystemPrompt: false,
      }),
    ).toBe(290);
  });

  it('usa el precio de escritura de caché cuando la tarea cachea el system prompt', () => {
    const plain = estimateReservation({
      model: 'claude-sonnet-5-5',
      countedInputTokens: 20_000,
      maxTokens: 4000,
      cacheSystemPrompt: false,
    });
    const cached = estimateReservation({
      model: 'claude-sonnet-5-5',
      countedInputTokens: 20_000,
      maxTokens: 4000,
      cacheSystemPrompt: true,
    });
    expect(cached).toBeGreaterThan(plain);
  });

  it('Sonnet con 16 000 de max_tokens reserva ≈ 0,20 USD (design § D4)', () => {
    const micro = estimateReservation({
      model: 'claude-sonnet-5-5',
      countedInputTokens: 20_000,
      maxTokens: 16_000,
      cacheSystemPrompt: false,
    });
    expect(microToUsd(micro)).toBeGreaterThan(0.2);
    expect(microToUsd(micro)).toBeLessThan(0.26);
  });

  it('Haiku por encima de 100K de entrada estimada usa la tarifa alta', () => {
    const low = estimateReservation({
      model: 'claude-haiku-5-5',
      countedInputTokens: 90_000,
      maxTokens: 100,
      cacheSystemPrompt: false,
    });
    const high = estimateReservation({
      model: 'claude-haiku-5-5',
      countedInputTokens: 95_000,
      maxTokens: 100,
      cacheSystemPrompt: false,
    });
    expect(high).toBeGreaterThan(low * 4);
  });

  it('redondea siempre hacia arriba (nunca 0 con tokens reales)', () => {
    expect(
      estimateReservation({
        model: 'claude-haiku-5-5',
        countedInputTokens: 0,
        maxTokens: 1,
        cacheSystemPrompt: false,
      }),
    ).toBeGreaterThan(0);
  });
});

describe('computeCost', () => {
  it('humo típico (200 de entrada, 50 de salida) con Haiku ≈ 0,00005 USD', () => {
    const cost = computeCost('claude-haiku-5-5', {
      inputTokens: 200,
      outputTokens: 50,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
    // 200 × 0,1 + 50 × 0,5 = 45 micro-USD
    expect(cost).toBe(45);
  });

  it('con y sin caché: lectura y escritura tienen su propia tarifa', () => {
    const cost = computeCost('claude-sonnet-5-5', {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      cacheWriteTokens: 1_000_000,
    });
    expect(cost).toBe(2_000_000 + 10_000_000 + 100_000 + 2_500_000);
  });

  it('Haiku elige la tarifa por la entrada total (entrada + escritura + lectura)', () => {
    const cost = computeCost('claude-haiku-5-5', {
      inputTokens: 60_000,
      outputTokens: 0,
      cacheReadTokens: 50_000,
      cacheWriteTokens: 0,
    });
    // total 110K > 100K: 60 000 × 0,5 + 50 000 × 0,05 = 30 000 + 2 500
    expect(cost).toBe(32_500);
  });

  it('redondea hacia arriba', () => {
    expect(
      computeCost('claude-haiku-5-5', {
        inputTokens: 1,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      }),
    ).toBe(1);
  });

  it('propiedad: costo real ≤ reserva si output ≤ max_tokens y la entrada real ≤ la estimada', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('claude-haiku-5-5' as const, 'claude-sonnet-5-5' as const),
        fc.integer({ min: 0, max: 120_000 }),
        fc.integer({ min: 1, max: 16_000 }),
        fc.boolean(),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (model, counted, maxTokens, cacheSystemPrompt, outRatio, readRatio, writeRatio) => {
          const reserved = estimateReservation({
            model,
            countedInputTokens: counted,
            maxTokens,
            cacheSystemPrompt,
          });
          const estimated = estimatedInputTokens(counted);
          // La entrada real es, como mucho, la estimada, repartida entre sin caché, lectura y escritura.
          const read = Math.floor(estimated * readRatio * 0.5);
          const write = cacheSystemPrompt ? Math.floor(estimated * writeRatio * 0.5) : 0;
          const plain = estimated - read - write;
          const cost = computeCost(model, {
            inputTokens: plain,
            outputTokens: Math.floor(maxTokens * outRatio),
            cacheReadTokens: read,
            cacheWriteTokens: write,
          });
          expect(cost).toBeLessThanOrEqual(reserved);
        },
      ),
    );
  });
});

describe('conversión de dinero', () => {
  it('USD ↔ micro-USD sin errores de coma flotante', () => {
    expect(usdToMicro(10)).toBe(10_000_000);
    expect(usdToMicro(0.07)).toBe(70_000);
    expect(microToUsd(1_900_000)).toBe(1.9);
  });
});
