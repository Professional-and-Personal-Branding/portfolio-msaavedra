import { describe, expect, it } from 'vitest';
import { readUrlState, writeUrlState } from './url-state';

describe('readUrlState', () => {
  it('lee lang, theme, layout y token', () => {
    const state = readUrlState(
      new URLSearchParams('lang=en&theme=elegant&layout=sidebar&token=abc'),
    );
    expect(state).toEqual({ lang: 'en', theme: 'elegant', layout: 'sidebar', token: 'abc' });
  });

  it('ignora lang inválido y valores vacíos', () => {
    const state = readUrlState(new URLSearchParams('lang=fr&theme=&layout'));
    expect(state).toEqual({ lang: null, theme: null, layout: null, token: null });
  });
});

describe('writeUrlState', () => {
  it('agrega y reemplaza claves sin tocar las demás', () => {
    const next = writeUrlState(new URLSearchParams('lang=es&foo=1'), {
      theme: 'minimal',
      lang: 'en',
    });
    expect(next.get('lang')).toBe('en');
    expect(next.get('theme')).toBe('minimal');
    expect(next.get('foo')).toBe('1');
  });

  it('null elimina la clave', () => {
    const next = writeUrlState(new URLSearchParams('theme=minimal&token=x'), { theme: null });
    expect(next.has('theme')).toBe(false);
    expect(next.get('token')).toBe('x');
  });

  it('no muta los params originales', () => {
    const original = new URLSearchParams('lang=es');
    writeUrlState(original, { lang: 'en' });
    expect(original.get('lang')).toBe('es');
  });
});
