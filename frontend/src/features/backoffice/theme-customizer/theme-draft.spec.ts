import { describe, expect, it } from 'vitest';
import { DEFAULT_TOKENS } from '@/themes/tokens';
import type { AdminTheme } from '../shared/admin-types';
import { baseTokensOf, diffTokens, effectiveTokens, isHexColor, setToken } from './theme-draft';

const ELEGANT: AdminTheme = {
  id: 't-el',
  slug: 'elegant',
  name: 'Elegant',
  isPreset: true,
  tokens: {
    mode: 'dark',
    colors: {
      bg: '#1a1814',
      bgSoft: '#221f1a',
      card: '#28241d',
      border: '#3a342a',
      text: '#f0ebe0',
      textMuted: '#b8ae9c',
      accent: '#c8a04e',
      accent2: '#e0c084',
    },
    typography: { fontSans: 'Georgia', fontHeading: 'Georgia', scale: 'default' },
    layout: { radius: '12px', maxWidth: '1000px', density: 'comfortable' },
    effects: { animations: true, glassmorphism: false },
  },
};

describe('baseTokensOf', () => {
  it('usa los tokens del tema elegido y el preset por defecto sin tema', () => {
    expect(baseTokensOf(ELEGANT).colors.accent).toBe('#c8a04e');
    expect(baseTokensOf(undefined)).toEqual(DEFAULT_TOKENS);
  });
});

describe('effectiveTokens', () => {
  it('sin overrides devuelve el tema base', () => {
    const base = baseTokensOf(ELEGANT);
    expect(effectiveTokens(base, null)).toEqual(base);
    expect(effectiveTokens(base, undefined)).toEqual(base);
  });

  it('los overrides pisan solo lo que definen', () => {
    const base = baseTokensOf(ELEGANT);
    const result = effectiveTokens(base, { colors: { accent: '#ff0000' } });
    expect(result.colors.accent).toBe('#ff0000');
    expect(result.colors.bg).toBe('#1a1814');
    expect(result.typography.fontSans).toBe('Georgia');
  });
});

describe('diffTokens', () => {
  it('sin cambios devuelve null', () => {
    const base = baseTokensOf(ELEGANT);
    expect(diffTokens(base, base)).toBeNull();
  });

  it('devuelve solo los tokens cambiados', () => {
    const base = baseTokensOf(ELEGANT);
    const current = setToken(base, 'colors', 'accent', '#ff0000');
    expect(diffTokens(base, current)).toEqual({ colors: { accent: '#ff0000' } });
  });

  it('agrupa cambios de varios grupos e incluye el modo', () => {
    const base = baseTokensOf(ELEGANT);
    let current = setToken(base, 'mode', 'mode', 'light');
    current = setToken(current, 'layout', 'density', 'compact');
    current = setToken(current, 'typography', 'fontSans', 'Inter');
    current = setToken(current, 'effects', 'animations', false);

    expect(diffTokens(base, current)).toEqual({
      mode: 'light',
      layout: { density: 'compact' },
      typography: { fontSans: 'Inter' },
      effects: { animations: false },
    });
  });

  it('volver al valor original elimina el override', () => {
    const base = baseTokensOf(ELEGANT);
    const changed = setToken(base, 'colors', 'accent', '#ff0000');
    const restored = setToken(changed, 'colors', 'accent', '#c8a04e');
    expect(diffTokens(base, restored)).toBeNull();
  });

  it('las diferencias se calculan siempre contra el tema base recibido', () => {
    const elegantBase = baseTokensOf(ELEGANT);
    const current = setToken(elegantBase, 'colors', 'accent', '#38bdf8');

    // contra elegant, el acento sí cambió
    expect(diffTokens(elegantBase, current)).toEqual({ colors: { accent: '#38bdf8' } });
    // contra modern-dark ese acento ya es el suyo, así que no figura entre las diferencias
    const againstDefault = diffTokens(DEFAULT_TOKENS, current);
    expect(againstDefault?.colors).not.toHaveProperty('accent');
    expect(againstDefault?.colors?.bg).toBe('#1a1814');
  });
});

describe('isHexColor', () => {
  it('acepta #rgb y #rrggbb, rechaza el resto', () => {
    expect(isHexColor('#fff')).toBe(true);
    expect(isHexColor('#38BDF8')).toBe(true);
    expect(isHexColor(' #38bdf8 ')).toBe(true);
    expect(isHexColor('38bdf8')).toBe(false);
    expect(isHexColor('no-es-color')).toBe(false);
    expect(isHexColor('')).toBe(false);
  });
});
