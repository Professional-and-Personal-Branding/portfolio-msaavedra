import { hintMargin, nextRetryDelay } from './next-retry-delay';

const HOUR = 3_600_000;

describe('nextRetryDelay', () => {
  it('con random = 0 devuelve el mínimo de 1 s en cualquier intento', () => {
    for (const attempt of [1, 2, 5, 12]) expect(nextRetryDelay(attempt, () => 0)).toBe(1000);
  });

  it.each([
    [1, 0.5, 15_000],
    [2, 0.5, 30_000],
    [5, 0.5, 240_000],
  ])('intento %i con random %f espera %i ms', (attempt, random, expected) => {
    expect(nextRetryDelay(attempt, () => random)).toBe(expected);
  });

  it('el intento 1 con random 0,999 queda bajo la base de 30 s', () => {
    expect(nextRetryDelay(1, () => 0.999)).toBe(29_970);
  });

  it('el intento 12 está topado en 6 h', () => {
    expect(nextRetryDelay(12, () => 0.5)).toBe(3 * HOUR);
    expect(nextRetryDelay(12, () => 0.999)).toBeLessThan(6 * HOUR);
    expect(nextRetryDelay(40, () => 0.999)).toBeLessThan(6 * HOUR);
  });

  it('un intento menor que 1 se trata como el primero', () => {
    expect(nextRetryDelay(0, () => 0.5)).toBe(15_000);
  });

  it('hintMargin va de 1 a 5 s', () => {
    expect(hintMargin(() => 0)).toBe(1000);
    expect(hintMargin(() => 0.999)).toBeLessThan(5000);
  });
});
