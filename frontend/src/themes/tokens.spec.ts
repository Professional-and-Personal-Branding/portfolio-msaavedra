import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_TOKENS, mergeTokens, parseThemeTokens, themeTokensSchema } from './tokens';

describe('mergeTokens', () => {
  it('completa tokens parciales con los de modern-dark', () => {
    const merged = mergeTokens(DEFAULT_TOKENS, { colors: { accent: '#ff0000' } });

    expect(merged.colors.accent).toBe('#ff0000');
    expect(merged.colors.bg).toBe(DEFAULT_TOKENS.colors.bg);
    expect(merged.typography).toEqual(DEFAULT_TOKENS.typography);
    expect(merged.layout).toEqual(DEFAULT_TOKENS.layout);
    expect(merged.effects).toEqual(DEFAULT_TOKENS.effects);
  });

  it('un override undefined no pisa el valor base', () => {
    const merged = mergeTokens(DEFAULT_TOKENS, { colors: { bg: undefined }, mode: undefined });
    expect(merged.colors.bg).toBe(DEFAULT_TOKENS.colors.bg);
    expect(merged.mode).toBe('dark');
  });

  it('no muta la base', () => {
    const base = structuredClone(DEFAULT_TOKENS);
    mergeTokens(base, { layout: { density: 'compact' } });
    expect(base.layout.density).toBe('comfortable');
  });
});

describe('parseThemeTokens', () => {
  it('acepta el JSON de la API y lo completa', () => {
    const tokens = parseThemeTokens({ mode: 'light', colors: { bg: '#fff' } });
    expect(tokens.mode).toBe('light');
    expect(tokens.colors.bg).toBe('#fff');
    expect(tokens.colors.accent).toBe(DEFAULT_TOKENS.colors.accent);
  });

  it('rechaza tokens inválidos y cae al default con advertencia', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const tokens = parseThemeTokens({ mode: 'sepia', layout: { density: 'huge' } });

    expect(tokens).toEqual(DEFAULT_TOKENS);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('null o undefined devuelven el default', () => {
    expect(parseThemeTokens(null)).toEqual(DEFAULT_TOKENS);
    expect(parseThemeTokens(undefined)).toEqual(DEFAULT_TOKENS);
  });
});

describe('themeTokensSchema', () => {
  it('valida el default completo', () => {
    expect(themeTokensSchema.safeParse(DEFAULT_TOKENS).success).toBe(true);
  });

  it('exige todos los grupos', () => {
    expect(themeTokensSchema.safeParse({ mode: 'dark' }).success).toBe(false);
  });
});
