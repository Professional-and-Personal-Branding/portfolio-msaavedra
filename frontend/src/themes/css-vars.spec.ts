import { describe, expect, it } from 'vitest';
import { fontStack, readableOn, tokensToCssVars } from './css-vars';
import { DEFAULT_TOKENS, mergeTokens } from './tokens';

describe('tokensToCssVars', () => {
  it('mapea todos los tokens a variables --t-*', () => {
    const vars = tokensToCssVars(DEFAULT_TOKENS);

    expect(vars['--t-bg']).toBe('#0a0e1a');
    expect(vars['--t-bg-soft']).toBe('#111827');
    expect(vars['--t-card']).toBe('#161d2e');
    expect(vars['--t-border']).toBe('#252d42');
    expect(vars['--t-text']).toBe('#e8edf5');
    expect(vars['--t-text-muted']).toBe('#94a3b8');
    expect(vars['--t-accent']).toBe('#38bdf8');
    expect(vars['--t-accent2']).toBe('#818cf8');
    expect(vars['--t-radius']).toBe('16px');
    expect(vars['--t-max-width']).toBe('1080px');
    expect(vars['--t-font-sans']).toMatch(/^Inter, /);
    expect(vars['--t-font-heading']).toMatch(/^Inter, /);
    expect(vars['--t-motion']).toBe('1');
    expect(vars['--t-glass']).toBe('1');
    expect(Object.keys(vars).every((key) => key.startsWith('--t-'))).toBe(true);
  });

  it('la densidad escala el espaciado base', () => {
    const compact = tokensToCssVars(
      mergeTokens(DEFAULT_TOKENS, { layout: { density: 'compact' } }),
    );
    const comfortable = tokensToCssVars(DEFAULT_TOKENS);
    const spacious = tokensToCssVars(
      mergeTokens(DEFAULT_TOKENS, { layout: { density: 'spacious' } }),
    );

    expect(parseFloat(compact['--t-space'])).toBeLessThan(parseFloat(comfortable['--t-space']));
    expect(parseFloat(spacious['--t-space'])).toBeGreaterThan(parseFloat(comfortable['--t-space']));
  });

  it('animations=false apaga la variable de movimiento', () => {
    const vars = tokensToCssVars(mergeTokens(DEFAULT_TOKENS, { effects: { animations: false } }));
    expect(vars['--t-motion']).toBe('0');
  });
});

describe('fontStack', () => {
  it('agrega fallback sans o serif según la familia', () => {
    expect(fontStack('Inter')).toMatch(/^Inter, ui-sans-serif/);
    expect(fontStack('Georgia')).toMatch(/^Georgia, ui-serif/);
    expect(fontStack('Playfair Display')).toMatch(/^"Playfair Display", ui-serif/);
  });
});

describe('readableOn', () => {
  it('elige texto oscuro sobre acentos claros y claro sobre oscuros', () => {
    expect(readableOn('#38bdf8')).toBe('#0a0e1a');
    expect(readableOn('#c8a04e')).toBe('#0a0e1a');
    expect(readableOn('#1d4ed8')).toBe('#ffffff');
    expect(readableOn('#18181b')).toBe('#ffffff');
    expect(readableOn('no-es-color')).toBe('#ffffff');
  });
});
