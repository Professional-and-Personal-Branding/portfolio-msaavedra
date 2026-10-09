import { mergeThemeTokens } from './merge-theme-tokens';

const base = {
  mode: 'dark',
  colors: { bg: '#0a0e1a', accent: '#38bdf8' },
  typography: { fontSans: 'Inter', fontHeading: 'Inter', scale: 'default' },
  effects: { animations: true, glassmorphism: true },
  order: ['a', 'b'],
};

describe('mergeThemeTokens (spec theme-resolution)', () => {
  it('override parcial de colores conserva hermanos', () => {
    const result = mergeThemeTokens(base, { colors: { accent: '#ff0000' } });
    expect(result.colors).toEqual({ bg: '#0a0e1a', accent: '#ff0000' });
  });

  it('el override migrado de colors.accent cambia solo ese token (retire-accent-color)', () => {
    const result = mergeThemeTokens(base, { colors: { accent: '#5B2C87' } });
    expect(result).toEqual({ ...base, colors: { bg: '#0a0e1a', accent: '#5B2C87' } });
  });

  it('override anidado no borra hermanos', () => {
    const result = mergeThemeTokens(base, { typography: { fontSans: 'Georgia' } });
    expect(result.typography).toEqual({
      fontSans: 'Georgia',
      fontHeading: 'Inter',
      scale: 'default',
    });
  });

  it('primitivos y arrays reemplazan', () => {
    const result = mergeThemeTokens(base, {
      mode: 'light',
      effects: { animations: false },
      order: ['z'],
    });
    expect(result.mode).toBe('light');
    expect(result.effects).toEqual({ animations: false, glassmorphism: true });
    expect(result.order).toEqual(['z']);
  });

  it('override nulo, undefined o no-objeto deja el base intacto', () => {
    expect(mergeThemeTokens(base, null)).toEqual(base);
    expect(mergeThemeTokens(base, undefined)).toEqual(base);
    expect(mergeThemeTokens(base, 'texto')).toEqual(base);
    expect(mergeThemeTokens(base, ['x'])).toEqual(base);
  });

  it('claves null en el override conservan el base', () => {
    const result = mergeThemeTokens(base, { mode: null, colors: { bg: null, accent: '#000' } });
    expect(result.mode).toBe('dark');
    expect(result.colors).toEqual({ bg: '#0a0e1a', accent: '#000' });
  });

  it('no muta el base ni el override', () => {
    const baseCopy = structuredClone(base);
    const override = { colors: { accent: '#ff0000' } };
    const overrideCopy = structuredClone(override);
    const result = mergeThemeTokens(base, override);
    (result.colors as Record<string, unknown>).accent = 'mutado';
    expect(base).toEqual(baseCopy);
    expect(override).toEqual(overrideCopy);
  });

  it('agrega claves nuevas del override', () => {
    const result = mergeThemeTokens(base, { extra: { x: 1 } });
    expect(result.extra).toEqual({ x: 1 });
  });
});
