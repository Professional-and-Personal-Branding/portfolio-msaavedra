import { describe, expect, it } from 'vitest';
import { readUrlState, writeUrlState } from './url-state';

describe('readUrlState', () => {
  it('lee lang, theme, layout y token', () => {
    const state = readUrlState(
      new URLSearchParams('lang=en&theme=elegant&layout=sidebar&token=abc'),
    );
    expect(state).toEqual({
      lang: 'en',
      theme: 'elegant',
      layout: 'sidebar',
      token: 'abc',
      via: null,
      src: null,
    });
  });

  it('lee via y src tal cual, sin validarlos ni normalizarlos', () => {
    const state = readUrlState(new URLSearchParams('via=K7m2Q9xw4T&src=Mi%20Portal'));
    expect(state.via).toBe('K7m2Q9xw4T');
    expect(state.src).toBe('Mi Portal');
  });

  it('via y src vacíos o repetidos: vacío es null y gana el primero', () => {
    expect(readUrlState(new URLSearchParams('via=&src=')).via).toBeNull();
    expect(readUrlState(new URLSearchParams('via=&src=')).src).toBeNull();
    expect(readUrlState(new URLSearchParams('via=x&via=y')).via).toBe('x');
  });

  it('ignora lang inválido y valores vacíos', () => {
    const state = readUrlState(new URLSearchParams('lang=fr&theme=&layout'));
    expect(state).toEqual({
      lang: null,
      theme: null,
      layout: null,
      token: null,
      via: null,
      src: null,
    });
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

  it('cambiar el idioma o el token conserva via y src', () => {
    const next = writeUrlState(new URLSearchParams('via=k7m2q9xw4t&src=indeed'), {
      lang: 'en',
      token: 'abc',
    });
    expect(next.get('via')).toBe('k7m2q9xw4t');
    expect(next.get('src')).toBe('indeed');
    expect(next.get('lang')).toBe('en');
    expect(next.get('token')).toBe('abc');
  });

  it('null elimina via y src', () => {
    const next = writeUrlState(new URLSearchParams('via=k7m2q9xw4t&src=indeed&lang=en'), {
      via: null,
      src: null,
    });
    expect(next.toString()).toBe('lang=en');
  });

  it('no muta los params originales', () => {
    const original = new URLSearchParams('lang=es');
    writeUrlState(original, { lang: 'en' });
    expect(original.get('lang')).toBe('es');
  });
});
