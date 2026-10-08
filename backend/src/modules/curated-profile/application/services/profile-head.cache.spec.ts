import { ProfileHeadCache } from './profile-head.cache';

describe('ProfileHeadCache', () => {
  it('devuelve lo guardado hasta que vence el TTL', () => {
    let now = 1_000;
    const cache = new ProfileHeadCache(() => now, 60_000, 10);
    cache.set('a|es', '<title>A</title>');
    now += 59_999;
    expect(cache.get('a|es')).toBe('<title>A</title>');
    now += 1;
    expect(cache.get('a|es')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('al llenarse saca la entrada más vieja', () => {
    const cache = new ProfileHeadCache(() => 0, 60_000, 2);
    cache.set('a', 'A');
    cache.set('b', 'B');
    cache.set('c', 'C');
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('B');
    expect(cache.get('c')).toBe('C');
    expect(cache.size).toBe(2);
  });

  it('volver a guardar una clave la renueva sin duplicarla', () => {
    let now = 0;
    const cache = new ProfileHeadCache(() => now, 10, 2);
    cache.set('a', 'A1');
    now = 5;
    cache.set('a', 'A2');
    now = 12;
    expect(cache.get('a')).toBe('A2');
    expect(cache.size).toBe(1);
  });
});
