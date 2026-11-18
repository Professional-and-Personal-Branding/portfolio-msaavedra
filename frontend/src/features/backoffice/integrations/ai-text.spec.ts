import { describe, expect, it } from 'vitest';
import { makeAiUsage } from '@/test/fixtures/ai';
import {
  costLabel,
  dayLabel,
  durationLabel,
  monthLabel,
  spentLine,
  stateText,
  usd2,
} from './ai-text';

describe('ai-text', () => {
  it('monthLabel y dayLabel usan el mes en español sin pasar por la zona horaria', () => {
    expect(monthLabel('2026-11')).toBe('noviembre de 2026');
    expect(monthLabel('2026-01')).toBe('enero de 2026');
    expect(monthLabel('raro')).toBe('raro');
    expect(dayLabel('2026-11-17')).toBe('17 de noviembre de 2026');
    expect(dayLabel('2026-12-01')).toBe('1 de diciembre de 2026');
  });

  it('usd2 usa coma y dos decimales', () => {
    expect(usd2(1.23)).toBe('1,23');
    expect(usd2(10)).toBe('10,00');
    expect(usd2(0.000045)).toBe('0,00');
  });

  it('costLabel muestra fracciones de centavo sin ceros de más', () => {
    expect(costLabel(null)).toBe('—');
    expect(costLabel(0)).toBe('0');
    expect(costLabel(45)).toBe('0,000045 USD');
    expect(costLabel(1_230_000)).toBe('1,23 USD');
    expect(costLabel(10_000_000)).toBe('10 USD');
  });

  it('spentLine arma la frase de la spec', () => {
    expect(spentLine(makeAiUsage({ spentUsd: 1.23, percentUsed: 12 }))).toBe(
      'Gastado 1,23 de 10,00 USD en noviembre de 2026 (12 %)',
    );
  });

  it('stateText: textos literales de cada estado', () => {
    expect(stateText(makeAiUsage({ state: 'DISABLED' }))).toBeNull();
    expect(stateText(makeAiUsage({ state: 'OK' }))).toBe('Activa');
    expect(stateText(makeAiUsage({ state: 'NEAR_LIMIT' }))).toBe('Cerca del tope del mes');
    expect(stateText(makeAiUsage({ state: 'EXHAUSTED' }))).toBe('Se alcanzó el tope de IA del mes');
    expect(stateText(makeAiUsage({ state: 'PROVIDER_BLOCKED', providerBlockedUntil: null }))).toBe(
      'Anthropic cortó por el spend limit hasta nuevo aviso',
    );
  });

  it('durationLabel', () => {
    expect(durationLabel(null)).toBe('—');
    expect(durationLabel(820)).toBe('820 ms');
    expect(durationLabel(1500)).toBe('1,5 s');
  });
});
